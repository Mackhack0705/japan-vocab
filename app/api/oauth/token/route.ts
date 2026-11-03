
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  REFRESH_TOKEN_LIFETIME_SECONDS,
  MCP_RESOURCE,
  generateOpaqueToken,
  hashToken,
  verifyPkceChallenge,
  expiresAt,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function oauthError(
  error: string,
  description: string,
  status = 400
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
      },
    }
  );
}

function oauthSuccess(data: Record<string, unknown>) {
  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function getParameter(
  params: URLSearchParams,
  name: string
): string {
  return params.get(name)?.trim() || "";
}

function parseRequestedScopes(
  value: string
): string[] | null {
  if (!value) return null;

  const scopes = [
    ...new Set(value.split(/\s+/).filter(Boolean)),
  ];

  return scopes.length > 0 ? scopes : null;
}

function isSubset(
  requested: string[],
  allowed: string[]
): boolean {
  return requested.every((scope) => allowed.includes(scope));
}

async function exchangeAuthorizationCode(
  params: URLSearchParams
) {
  const clientId = getParameter(params, "client_id");
  const code = getParameter(params, "code");
  const redirectUri = getParameter(params, "redirect_uri");
  const codeVerifier = getParameter(params, "code_verifier");
  const resource = getParameter(params, "resource");
  const requestedScope = getParameter(params, "scope");

  if (
    !clientId ||
    !code ||
    !redirectUri ||
    !codeVerifier ||
    !resource
  ) {
    return oauthError(
      "invalid_request",
      "client_id, code, redirect_uri, code_verifier and resource are required."
    );
  }

  if (resource !== MCP_RESOURCE) {
    return oauthError(
      "invalid_target",
      "The requested resource is not supported."
    );
  }

  const authorizationCode =
    await prisma.oAuthAuthorizationCode.findUnique({
      where: {
        codeHash: hashToken(code),
      },
    });

  if (
    !authorizationCode ||
    authorizationCode.clientId !== clientId ||
    authorizationCode.redirectUri !== redirectUri ||
    authorizationCode.resource !== resource ||
    authorizationCode.codeChallengeMethod !== "S256" ||
    authorizationCode.consumedAt !== null ||
    authorizationCode.expiresAt <= new Date()
  ) {
    return oauthError(
      "invalid_grant",
      "The authorization code is invalid, expired, or already used."
    );
  }

  if (
    !verifyPkceChallenge(
      codeVerifier,
      authorizationCode.codeChallenge
    )
  ) {
    return oauthError(
      "invalid_grant",
      "The PKCE code verifier is invalid."
    );
  }

  if (requestedScope) {
    const requestedScopes =
      parseRequestedScopes(requestedScope);

    if (
      !requestedScopes ||
      !isSubset(requestedScopes, authorizationCode.scopes)
    ) {
      return oauthError(
        "invalid_scope",
        "The requested scope exceeds the authorized scope."
      );
    }
  }

  const accessToken = generateOpaqueToken(32);
  const refreshToken = generateOpaqueToken(48);
  const familyId = generateOpaqueToken(24);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const consumed =
      await tx.oAuthAuthorizationCode.updateMany({
        where: {
          id: authorizationCode.id,
          consumedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          consumedAt: now,
        },
      });

    if (consumed.count !== 1) {
      return false;
    }

    await tx.oAuthAccessToken.create({
      data: {
        tokenHash: hashToken(accessToken),
        familyId,
        clientId,
        resource,
        scopes: authorizationCode.scopes,
        expiresAt: expiresAt(
          ACCESS_TOKEN_LIFETIME_SECONDS
        ),
      },
    });

    await tx.oAuthRefreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        familyId,
        clientId,
        resource,
        scopes: authorizationCode.scopes,
        expiresAt: expiresAt(
          REFRESH_TOKEN_LIFETIME_SECONDS
        ),
      },
    });

    return true;
  });

  if (!result) {
    return oauthError(
      "invalid_grant",
      "The authorization code has already been used."
    );
  }

  return oauthSuccess({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
    refresh_token: refreshToken,
    scope: authorizationCode.scopes.join(" "),
  });
}

async function revokeTokenFamily(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  familyId: string,
  now: Date
) {
  await tx.oAuthRefreshToken.updateMany({
    where: {
      familyId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
    },
  });

  await tx.oAuthAccessToken.updateMany({
    where: {
      familyId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
    },
  });
}

async function exchangeRefreshToken(
  params: URLSearchParams
) {
  const clientId = getParameter(params, "client_id");
  const refreshToken = getParameter(params, "refresh_token");
  const resource = getParameter(params, "resource");
  const requestedScope = getParameter(params, "scope");

  if (!clientId || !refreshToken || !resource) {
    return oauthError(
      "invalid_request",
      "client_id, refresh_token and resource are required."
    );
  }

  if (resource !== MCP_RESOURCE) {
    return oauthError(
      "invalid_target",
      "The requested resource is not supported."
    );
  }

  const existingToken =
    await prisma.oAuthRefreshToken.findUnique({
      where: {
        tokenHash: hashToken(refreshToken),
      },
    });

  if (
    !existingToken ||
    existingToken.clientId !== clientId ||
    existingToken.resource !== resource
  ) {
    return oauthError(
      "invalid_grant",
      "The refresh token is invalid."
    );
  }

  const requestedScopes = requestedScope
    ? parseRequestedScopes(requestedScope)
    : existingToken.scopes;

  if (
    !requestedScopes ||
    !isSubset(requestedScopes, existingToken.scopes)
  ) {
    return oauthError(
      "invalid_scope",
      "The requested scope exceeds the original authorization."
    );
  }

  const accessToken = generateOpaqueToken(32);
  const newRefreshToken = generateOpaqueToken(48);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const currentToken =
      await tx.oAuthRefreshToken.findUnique({
        where: {
          id: existingToken.id,
        },
      });

    if (!currentToken) {
      return {
        success: false as const,
        reason: "invalid" as const,
      };
    }

    if (currentToken.consumedAt !== null) {
      await revokeTokenFamily(
        tx,
        currentToken.familyId,
        now
      );

      return {
        success: false as const,
        reason: "reuse" as const,
      };
    }

    if (
      currentToken.revokedAt !== null ||
      currentToken.expiresAt <= now
    ) {
      return {
        success: false as const,
        reason: "invalid" as const,
      };
    }

    const consumed =
      await tx.oAuthRefreshToken.updateMany({
        where: {
          id: currentToken.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          consumedAt: now,
        },
      });

    if (consumed.count !== 1) {
      await revokeTokenFamily(
        tx,
        currentToken.familyId,
        now
      );

      return {
        success: false as const,
        reason: "reuse" as const,
      };
    }

    await tx.oAuthAccessToken.create({
      data: {
        tokenHash: hashToken(accessToken),
        familyId: currentToken.familyId,
        clientId,
        resource,
        scopes: requestedScopes,
        expiresAt: expiresAt(
          ACCESS_TOKEN_LIFETIME_SECONDS
        ),
      },
    });

    await tx.oAuthRefreshToken.create({
      data: {
        tokenHash: hashToken(newRefreshToken),
        familyId: currentToken.familyId,
        clientId,
        resource,
        scopes: requestedScopes,
        expiresAt: expiresAt(
          REFRESH_TOKEN_LIFETIME_SECONDS
        ),
      },
    });

    return {
      success: true as const,
    };
  });

  if (!result.success) {
    return oauthError(
      "invalid_grant",
      result.reason === "reuse"
        ? "Refresh token reuse detected. The token family has been revoked. Please authorize again."
        : "The refresh token is expired, revoked, or invalid."
    );
  }

  return oauthSuccess({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
    refresh_token: newRefreshToken,
    scope: requestedScopes.join(" "),
  });
}

export async function POST(request: NextRequest) {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/x-www-form-urlencoded")
  ) {
    return oauthError(
      "invalid_request",
      "Content-Type must be application/x-www-form-urlencoded."
    );
  }

  try {
    const body = await request.text();

    if (body.length > 16_384) {
      return oauthError(
        "invalid_request",
        "The request body is too large.",
        413
      );
    }

    const params = new URLSearchParams(body);
    const grantType = getParameter(params, "grant_type");

    if (grantType === "authorization_code") {
      return await exchangeAuthorizationCode(params);
    }

    if (grantType === "refresh_token") {
      return await exchangeRefreshToken(params);
    }

    if (!grantType) {
      return oauthError(
        "invalid_request",
        "grant_type is required."
      );
    }

    return oauthError(
      "unsupported_grant_type",
      "Only authorization_code and refresh_token are supported."
    );
  } catch (error) {
    console.error("OAuth token exchange failed:", error);

    return oauthError(
      "server_error",
      "The token request could not be completed.",
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
