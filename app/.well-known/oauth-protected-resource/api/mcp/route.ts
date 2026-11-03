import {
  MCP_RESOURCE,
  OAUTH_ISSUER,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    {
      resource: MCP_RESOURCE,
      authorization_servers: [OAUTH_ISSUER],
      scopes_supported: ["vocabulary:write"],
      bearer_methods_supported: ["header"],
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