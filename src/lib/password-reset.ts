import { createHmac, timingSafeEqual } from "node:crypto";
import { parsePassword } from "@/lib/password";

const TTL_MS = 1000 * 60 * 60;

function secret() {
  return (
    process.env.PASSWORD_RESET_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    "enforma-password-reset"
  );
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPasswordResetToken(userId: string) {
  const payload = `${userId}:${Date.now() + TTL_MS}`;
  return `${encode(payload)}.${sign(payload)}`;
}

export function readPasswordResetToken(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const payload = decode(encoded);
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  const [userId, expiresRaw] = payload.split(":");
  const expiresAt = Number(expiresRaw);
  if (!userId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }
  return userId;
}

export function parseResetPassword(raw: string) {
  return parsePassword(raw);
}
