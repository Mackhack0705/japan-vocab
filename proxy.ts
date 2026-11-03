
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // MCP validates its own OAuth bearer tokens.
  if (pathname === "/api/mcp") {
    return NextResponse.next();
  }

  // Public website authentication routes.
  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout"
  ) {
    return NextResponse.next();
  }

  // OAuth authorization GET handles its own session check
  // so it can preserve the complete authorization query.
  if (
    pathname === "/api/oauth/authorize" &&
    request.method === "GET"
  ) {
    return NextResponse.next();
  }

  // OAuth protocol endpoints do not use the website password cookie.
  if (
    pathname === "/api/oauth/register" ||
    pathname === "/api/oauth/token"
  ) {
    return NextResponse.next();
  }

  const isMutation = [
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
  ].includes(request.method);

  if (
    isMutation &&
    pathname.startsWith("/api/") &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { error: "Invalid origin" },
      { status: 403 }
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"
  ]
};
