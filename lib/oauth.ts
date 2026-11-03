import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const APP_ORIGIN = "https://nihongokotoba.vercel.app";

export const MCP_RESOURCE = `${APP_ORIGIN}/api/mcp`;

export const OAUTH_ISSUER = APP_ORIGIN;

export const OAUTH_ENDPOINTS = {
  authorize: `${APP_ORIGIN}/api/oauth/authorize`,
  token: `${APP_ORIGIN}/api/oauth/token`,
  register: `${APP_ORIGIN}/api/oauth/register`,
};

export const OAUTH_METADATA_URL =
  `${APP_ORIGIN}/.well-known/oauth-authorization-server`;

export const PROTECTED_RESOURCE_METADATA_URL =
  `${APP_ORIGIN}/.well-known/oauth-protected-resource/api/mcp`;

export const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60;

export const REFRESH_TOKEN_LIFETIME_SECONDS =
  30 * 24 * 60 * 60;

export const AUTHORIZATION_CODE_LIFETIME_SECONDS = 5 * 60;

/**
 * Generates a cryptographically secure opaque token.
 */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Stores only a SHA-256 hash of an opaque token in the database.
 */
export function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * Compares two strings without leaking comparison timing.
 */
export function constantTimeEqual(
  first: string,
  second: string
): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return timingSafeEqual(firstBuffer, secondBuffer);
}

/**
 * Validates an OAuth PKCE S256 code verifier against its challenge.
 */
export function verifyPkceChallenge(
  verifier: string,
  challenge: string
): boolean {
  if (
    verifier.length < 43 ||
    verifier.length > 128 ||
    !/^[A-Za-z0-9\-._~]+$/.test(verifier)
  ) {
    return false;
  }

  const calculatedChallenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return constantTimeEqual(
    calculatedChallenge,
    challenge
  );
}

/**
 * Returns the current Unix timestamp in seconds.
 */
export function currentUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Converts a lifetime in seconds into a Date.
 */
export function expiresAt(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}