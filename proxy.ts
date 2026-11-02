
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // MCP has its own Bearer-token authentication.
  if (pathname === "/api/mcp") {
    return NextResponse.next();
  }

  // Public login and authentication endpoints.
  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"]
    .includes(request.method);

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

  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  // API requests receive JSON instead of an HTML redirect.
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
