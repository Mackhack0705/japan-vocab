
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

import { prisma } from "@/lib/prisma";
import { generateOpaqueToken } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "15 m"),
  prefix: "nihonkotoba:oauth:register",
});

const ALLOWED_GRANT_TYPES = [
  "authorization_code",
  "refresh_token",
];

const ALLOWED_RESPONSE_TYPES = ["code"];

const ALLOWED_AUTH_METHODS = ["none"];

function oauthError(
  error: string,
  description: string,
  status = 400,
  headers?: HeadersInit
) {
  return NextResponse.json(
    {
      error,
      error_description: description,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        "Access-Control-Allow-Origin": "*",
        ...headers,
      },
    }
  );
}

function isValidRedirectUri(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) {
    return false;
  }

  try {
    const url = new URL(value);

    if (
      url.hash ||
      url.username ||
      url.password
    ) {
      return false;
    }

    if (url.protocol === "https:") {
      return true;
    }

    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "http:" &&
      (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]"
      )
    );
  } catch {
    return false;
  }
}

function getClientIp(request: NextRequest): string {
  // Vercel supplies x-real-ip from the connecting client.
  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim().slice(0, 100);
  }

  // Fallback for other trusted proxy environments.
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim().slice(0, 100);
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const rateLimit = await ratelimit.limit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000)
      );

      return oauthError(
        "temporarily_unavailable",
        "Too many client registration requests. Try again later.",
        429,
        {
          "Retry-After": String(retryAfter),
        }
      );
    }
  } catch (error) {
    console.error("OAuth registration rate limiter failed:", error);

    // Fail closed: don't allow unlimited registration if Redis is unavailable.
    return oauthError(
      "temporarily_unavailable",
      "Client registration is temporarily unavailable.",
      503
    );
  }

  try {
    const contentType =
      request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return oauthError(
        "invalid_client_metadata",
        "Content-Type must be application/json."
      );
    }

    const contentLength = Number(
      request.headers.get("content-length") || "0"
    );

    if (contentLength > 16_384) {
      return oauthError(
        "invalid_client_metadata",
        "Registration request is too large.",
        413
      );
    }

    const bodyText = await request.text();

    if (bodyText.length > 16_384) {
      return oauthError(
        "invalid_client_metadata",
        "Registration request is too large.",
        413
      );
    }

    const body = JSON.parse(bodyText);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return oauthError(
        "invalid_client_metadata",
        "Invalid registration request."
      );
    }

    const {
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
    } = body;

    if (
      !Array.isArray(redirect_uris) ||
      redirect_uris.length === 0 ||
      redirect_uris.length > 10 ||
      !redirect_uris.every(isValidRedirectUri) ||
      new Set(redirect_uris).size !== redirect_uris.length
    ) {
      return oauthError(
        "invalid_redirect_uri",
        "Provide between 1 and 10 unique valid redirect URIs. HTTPS is required except for loopback clients."
      );
    }

    const requestedGrantTypes =
      grant_types === undefined
        ? ["authorization_code"]
        : grant_types;

    const requestedResponseTypes =
      response_types === undefined
        ? ["code"]
        : response_types;

    const requestedAuthMethod =
      token_endpoint_auth_method === undefined
        ? "none"
        : token_endpoint_auth_method;

    if (
      !Array.isArray(requestedGrantTypes) ||
      requestedGrantTypes.length === 0 ||
      !requestedGrantTypes.every(
        (value: unknown) =>
          typeof value === "string" &&
          ALLOWED_GRANT_TYPES.includes(value)
      ) ||
      !requestedGrantTypes.includes("authorization_code")
    ) {
      return oauthError(
        "invalid_client_metadata",
        "Only authorization_code and refresh_token grant types are supported."
      );
    }

    if (
      !Array.isArray(requestedResponseTypes) ||
      requestedResponseTypes.length !== 1 ||
      requestedResponseTypes[0] !== "code"
    ) {
      return oauthError(
        "invalid_client_metadata",
        "Only the code response type is supported."
      );
    }

    if (!ALLOWED_AUTH_METHODS.includes(requestedAuthMethod)) {
      return oauthError(
        "invalid_client_metadata",
        "Only public clients using token_endpoint_auth_method none are supported."
      );
    }

    if (
      client_name !== undefined &&
      (
        typeof client_name !== "string" ||
        client_name.trim().length === 0 ||
        client_name.length > 100
      )
    ) {
      return oauthError(
        "invalid_client_metadata",
        "client_name must be a non-empty string of at most 100 characters."
      );
    }

    const clientId = `nihon_${generateOpaqueToken(24)}`;

    const clientName =
      typeof client_name === "string"
        ? client_name.trim()
        : "MCP Client";

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientName,
        redirectUris: redirect_uris,
        grantTypes: requestedGrantTypes,
        responseTypes: requestedResponseTypes,
        tokenEndpointAuthMethod: "none",
      },
    });

    return NextResponse.json(
      {
        client_id: client.clientId,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method:
          client.tokenEndpointAuthMethod,
        client_id_issued_at: Math.floor(
          client.createdAt.getTime() / 1000
        ),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("OAuth client registration failed:", error);

    return oauthError(
      "server_error",
      "Client registration failed.",
      500
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
