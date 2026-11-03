
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

import {
  hashToken,
  MCP_RESOURCE,
  PROTECTED_RESOURCE_METADATA_URL,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_SCOPE = "vocabulary:write";

function getAllowedHosts(): Set<string> {
  const configured =
    process.env.MCP_ALLOWED_HOSTS ||
    "nihongokotoba.vercel.app";

  return new Set(
    configured
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getAllowedOrigins(): Set<string> {
  const configured =
    process.env.MCP_ALLOWED_ORIGINS || "";

  return new Set(
    configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

/**
 * Validate Host on every transport request.
 * Validate Origin when supplied.
 */
function isTrustedTransportRequest(request: Request): boolean {
  const host = request.headers
    .get("host")
    ?.trim()
    .toLowerCase();

  if (!host || !getAllowedHosts().has(host)) {
    return false;
  }

  const originHeader = request.headers.get("origin");

  // Non-browser clients may omit Origin.
  if (!originHeader) {
    return true;
  }

  try {
    const origin = new URL(originHeader);

    if (
      origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(
          origin.hostname
        )
      )
    ) {
      return false;
    }

    // Same-host browser requests are allowed.
    if (origin.host.toLowerCase() === host) {
      return true;
    }

    // Cross-origin browser requests require explicit approval.
    return getAllowedOrigins().has(origin.origin);
  } catch {
    return false;
  }
}

function forbiddenOriginResponse() {
  return Response.json(
    {
      error: "Forbidden",
      error_description:
        "The request Host or Origin is not trusted.",
    },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function authenticationResponse(invalidToken = false) {
  const parameters = [
    `resource_metadata="${PROTECTED_RESOURCE_METADATA_URL}"`,
    `scope="${REQUIRED_SCOPE}"`,
  ];

  if (invalidToken) {
    parameters.push('error="invalid_token"');
  }

  return Response.json(
    {
      error: invalidToken ? "invalid_token" : "unauthorized",
      error_description: invalidToken
        ? "The access token is invalid, expired, or revoked."
        : "A valid OAuth access token is required.",
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer ${parameters.join(", ")}`,
        "Cache-Control": "no-store",
      },
    }
  );
}

function insufficientScopeResponse() {
  return Response.json(
    {
      error: "insufficient_scope",
      error_description:
        "The access token does not have permission to add vocabulary.",
    },
    {
      status: 403,
      headers: {
        "WWW-Authenticate":
          `Bearer resource_metadata="${PROTECTED_RESOURCE_METADATA_URL}", error="insufficient_scope", scope="${REQUIRED_SCOPE}"`,
        "Cache-Control": "no-store",
      },
    }
  );
}

async function validateAccessToken(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return {
      authenticated: false as const,
      invalidToken: false,
    };
  }

  const match = authorization.match(
    /^Bearer\s+([A-Za-z0-9_-]+)$/i
  );

  if (!match) {
    return {
      authenticated: false as const,
      invalidToken: true,
    };
  }

  const tokenHash = hashToken(match[1]);

  const token = await prisma.oAuthAccessToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!token) {
    return {
      authenticated: false as const,
      invalidToken: true,
    };
  }

  if (
    token.resource !== MCP_RESOURCE ||
    token.revokedAt !== null ||
    token.expiresAt <= new Date()
  ) {
    return {
      authenticated: false as const,
      invalidToken: true,
    };
  }

  if (!token.scopes.includes(REQUIRED_SCOPE)) {
    return {
      authenticated: true as const,
      insufficientScope: true,
    };
  }

  return {
    authenticated: true as const,
    insufficientScope: false,
  };
}

function createMcpServer() {
  const server = new McpServer({
    name: "nihonkotoba",
    version: "1.0.0",
  });

  server.tool(
    "add_vocabulary",
    "Add a Japanese vocabulary entry to the Nihonkotoba database.",
    {
      japanese: z.string().min(1),
      reading: z.string().min(1),
      meaning: z.string().min(1),
      explanation: z.string().optional(),
      exampleJapanese: z.string().min(1),
      exampleEnglish: z.string().min(1),
      jlptLevel: z.enum(["N5", "N4", "N3", "N2", "N1"]),
    },
    async (vocabulary) => {
      try {
        const result = await prisma.vocabulary.create({
          data: {
            japanese: vocabulary.japanese,
            reading: vocabulary.reading,
            meaning: vocabulary.meaning,
            explanation: vocabulary.explanation || null,
            exampleJapanese: vocabulary.exampleJapanese,
            exampleEnglish: vocabulary.exampleEnglish,
            jlptLevel: vocabulary.jlptLevel,
            tags: [],
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "Vocabulary added successfully",
                vocabulary: result,
              }),
            },
          ],
        };
      } catch (error) {
        console.error("Vocabulary insertion failed:", error);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Failed to save vocabulary.",
            },
          ],
        };
      }
    }
  );

  return server;
}

export async function POST(request: Request) {
  try {
    if (!isTrustedTransportRequest(request)) {
      return forbiddenOriginResponse();
    }

    const authentication =
      await validateAccessToken(request);

    if (!authentication.authenticated) {
      return authenticationResponse(
        authentication.invalidToken
      );
    }

    if (authentication.insufficientScope) {
      return insufficientScopeResponse();
    }

    const server = createMcpServer();

    const transport =
      new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

    await server.connect(transport);

    return await transport.handleRequest(request);
  } catch (error) {
    console.error("MCP request failed:", error);

    return Response.json(
      {
        error: "MCP server error",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(request: Request) {
  if (!isTrustedTransportRequest(request)) {
    return forbiddenOriginResponse();
  }

  return Response.json(
    {
      error: "Use POST for MCP requests",
    },
    {
      status: 405,
    }
  );
}

export async function OPTIONS(request: Request) {
  if (!isTrustedTransportRequest(request)) {
    return forbiddenOriginResponse();
  }

  const origin = request.headers.get("origin");

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, MCP-Protocol-Version",
      "Access-Control-Expose-Headers":
        "WWW-Authenticate, MCP-Session-Id",
      "Vary": "Origin",
    },
  });
}
