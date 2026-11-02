
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return NextResponse.json(
      { error: "Invalid origin" },
      { status: 403 }
    );
  }

  try {
    const originUrl = new URL(origin);

    if (originUrl.host !== host) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid origin" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    success: true
  });

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });

  return response;
}
