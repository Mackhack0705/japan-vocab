
import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

export const SESSION_COOKIE = "nihonkotoba_session";

const SESSION_DURATION = 12 * 60 * 60;

type SessionPayload = {
  exp: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short");
  }

  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken() {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string) {
  if (!token) return false;

  try {
    const parts = token.split(".");

    if (parts.length !== 2) return false;

    const [payload, signature] = parts;

    const expected = sign(payload);

    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return false;
    }

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ) as SessionPayload;

    return (
      typeof decoded.exp === "number" &&
      decoded.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
