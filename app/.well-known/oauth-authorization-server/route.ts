import {
  OAUTH_ENDPOINTS,
  OAUTH_ISSUER,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    {
      issuer: OAUTH_ISSUER,

      authorization_endpoint: OAUTH_ENDPOINTS.authorize,
      token_endpoint: OAUTH_ENDPOINTS.token,
      registration_endpoint: OAUTH_ENDPOINTS.register,

      response_types_supported: ["code"],
      response_modes_supported: ["query"],

      grant_types_supported: [
        "authorization_code",
        "refresh_token",
      ],

      code_challenge_methods_supported: ["S256"],

      token_endpoint_auth_methods_supported: ["none"],

      scopes_supported: ["vocabulary:write"],

      client_name: "Nihonkotoba",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}