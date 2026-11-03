
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  AUTHORIZATION_CODE_LIFETIME_SECONDS,
  generateOpaqueToken,
  hashToken,
  MCP_RESOURCE,
  expiresAt,
} from "@/lib/oauth";

import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SCOPES = ["vocabulary:write"];

type AuthorizationParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  responseType: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scope: string;
};

type ValidationResult =
  | {
      ok: true;
      client: {
        clientName: string;
      };
      scopes: string[];
    }
  | {
      ok: false;
      error: string;
      description: string;
    };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function errorResponse(
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
      },
    }
  );
}

async function validateAuthorizationRequest(
  params: AuthorizationParams
): Promise<ValidationResult> {
  if (
    !params.clientId ||
    !params.redirectUri ||
    !params.state ||
    params.state.length > 512 ||
    !params.responseType ||
    !params.codeChallenge ||
    !params.codeChallengeMethod ||
    !params.resource
  ) {
    return {
      ok: false,
      error: "invalid_request",
      description: "Required OAuth parameters are missing or invalid.",
    };
  }

  if (params.responseType !== "code") {
    return {
      ok: false,
      error: "unsupported_response_type",
      description: "Only the code response type is supported.",
    };
  }

  if (params.codeChallengeMethod !== "S256") {
    return {
      ok: false,
      error: "invalid_request",
      description: "Only PKCE S256 is supported.",
    };
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) {
    return {
      ok: false,
      error: "invalid_request",
      description: "A valid PKCE S256 code challenge is required.",
    };
  }

  if (params.resource !== MCP_RESOURCE) {
    return {
      ok: false,
      error: "invalid_target",
      description: "The requested resource is not supported.",
    };
  }

  const client = await prisma.oAuthClient.findUnique({
    where: {
      clientId: params.clientId,
    },
  });

  if (!client) {
    return {
      ok: false,
      error: "invalid_client",
      description: "The OAuth client is not registered.",
    };
  }

  if (!client.redirectUris.includes(params.redirectUri)) {
    return {
      ok: false,
      error: "invalid_request",
      description: "The redirect URI does not match the registered URI.",
    };
  }

  if (
    !client.grantTypes.includes("authorization_code") ||
    !client.responseTypes.includes("code") ||
    client.tokenEndpointAuthMethod !== "none"
  ) {
    return {
      ok: false,
      error: "unauthorized_client",
      description: "This OAuth client is not allowed to use this flow.",
    };
  }

  const requestedScopes = params.scope
    ? [...new Set(params.scope.split(/\s+/).filter(Boolean))]
    : ALLOWED_SCOPES;

  if (
    requestedScopes.length === 0 ||
    requestedScopes.some(
      (scope) => !ALLOWED_SCOPES.includes(scope)
    )
  ) {
    return {
      ok: false,
      error: "invalid_scope",
      description: "One or more requested scopes are not supported.",
    };
  }

  return {
    ok: true,
    client,
    scopes: requestedScopes,
  };
}

function getParams(
  searchParams: URLSearchParams
): AuthorizationParams {
  return {
    clientId: searchParams.get("client_id") || "",
    redirectUri: searchParams.get("redirect_uri") || "",
    state: searchParams.get("state") || "",
    responseType: searchParams.get("response_type") || "",
    codeChallenge: searchParams.get("code_challenge") || "",
    codeChallengeMethod:
      searchParams.get("code_challenge_method") || "",
    resource: searchParams.get("resource") || "",
    scope: searchParams.get("scope") || "",
  };
}

function getSessionIsValid(request: NextRequest): boolean {
  return verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );
}

function renderConsentPage(
  clientName: string,
  params: AuthorizationParams,
  scopes: string[]
) {
  const hiddenFields = Object.entries({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    response_type: params.responseType,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    resource: params.resource,
    scope: scopes.join(" "),
  })
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`
    )
    .join("\n");

  const safeClientName = escapeHtml(clientName);

  const scopeDescription = scopes
    .map((scope) => {
      if (scope === "vocabulary:write") {
        return "<li>Add Japanese vocabulary entries to your database.</li>";
      }

      return "";
    })
    .join("");

  // The redirect URI has already been validated against the
  // registered OAuth client's redirect URI list.
  // Allow only its origin in form-action so Chrome can follow
  // the authorization response redirect.
  const redirectOrigin = new URL(params.redirectUri).origin;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize ${safeClientName} - Nihonkotoba</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f1f5f9;
      color: #0f172a;
      font-family: system-ui, sans-serif;
    }
    main {
      width: 100%;
      max-width: 440px;
      padding: 32px;
      border-radius: 18px;
      background: white;
      box-shadow: 0 10px 30px rgba(15, 23, 42, .08);
    }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { color: #475569; line-height: 1.6; }
    ul { padding-left: 22px; line-height: 1.7; }
    button {
      width: 100%;
      border: 0;
      border-radius: 10px;
      padding: 13px 16px;
      margin-top: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    .approve { background: #0f172a; color: white; }
    .deny { background: #e2e8f0; color: #0f172a; }
    .notice { font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
  <main>
    <h1>Nihonkotoba</h1>
    <p><strong>${safeClientName}</strong> is requesting permission to access your vocabulary workspace.</p>
    <p>This application will be able to:</p>
    <ul>${scopeDescription}</ul>
    <p class="notice">Only approve this request if you initiated the connection in Claude.</p>
    <form method="POST">
      ${hiddenFields}
      <button class="approve" type="submit" name="decision" value="approve">
        Approve access
      </button>
      <button class="deny" type="submit" name="decision" value="deny">
        Deny
      </button>
    </form>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${redirectOrigin}; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}

export async function GET(request: NextRequest) {
  const params = getParams(request.nextUrl.searchParams);

  const validation = await validateAuthorizationRequest(params);

  if (!validation.ok) {
    return errorResponse(
      validation.error,
      validation.description
    );
  }

  if (!getSessionIsValid(request)) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );

    return NextResponse.redirect(loginUrl);
  }

  return renderConsentPage(
    validation.client.clientName,
    params,
    validation.scopes
  );
}

export async function POST(request: NextRequest) {
  if (!getSessionIsValid(request)) {
    return errorResponse(
      "access_denied",
      "Your website session has expired. Sign in again.",
      401
    );
  }

  const formData = await request.formData();

  const params: AuthorizationParams = {
    clientId: String(formData.get("client_id") || ""),
    redirectUri: String(formData.get("redirect_uri") || ""),
    state: String(formData.get("state") || ""),
    responseType: String(formData.get("response_type") || ""),
    codeChallenge: String(formData.get("code_challenge") || ""),
    codeChallengeMethod: String(
      formData.get("code_challenge_method") || ""
    ),
    resource: String(formData.get("resource") || ""),
    scope: String(formData.get("scope") || ""),
  };

  const decision = String(formData.get("decision") || "");

  const validation = await validateAuthorizationRequest(params);

  if (!validation.ok) {
    return errorResponse(
      validation.error,
      validation.description
    );
  }

  const redirectUrl = new URL(params.redirectUri);

  if (decision !== "approve") {
    redirectUrl.searchParams.set("error", "access_denied");
    redirectUrl.searchParams.set(
      "error_description",
      "The resource owner denied the authorization request."
    );
    redirectUrl.searchParams.set("state", params.state);

    return NextResponse.redirect(redirectUrl, 303);
  }

  const authorizationCode = generateOpaqueToken(32);

  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash: hashToken(authorizationCode),
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: "S256",
      resource: params.resource,
      scopes: validation.scopes,
      expiresAt: expiresAt(
        AUTHORIZATION_CODE_LIFETIME_SECONDS
      ),
    },
  });

  redirectUrl.searchParams.set("code", authorizationCode);
  redirectUrl.searchParams.set("state", params.state);

  return NextResponse.redirect(redirectUrl, 303);
}
