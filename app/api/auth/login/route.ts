
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE
} from "@/lib/auth";
import { createHash, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "nihonkotoba:login"
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Reject cross-origin login attempts.
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

  const ip =
  request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim() ?? "unknown";

    const { success } = await ratelimit.limit(ip);

    if (!success) {
    return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
    );
    }

  try {
    const { password } = await request.json();


    const ownerPassword = process.env.OWNER_PASSWORD;

    if (!ownerPassword || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const suppliedHash = createHash("sha256")
      .update(password)
      .digest();

    const expectedHash = createHash("sha256")
      .update(ownerPassword)
      .digest();

    if (!timingSafeEqual(suppliedHash, expectedHash)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = createSessionToken();

    const response = NextResponse.json({
      success: true
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
