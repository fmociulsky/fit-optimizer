import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const RESERVED = new Set(["1234", "1111", "2222"]);

export function parseUsername(raw: string) {
  const username = raw.trim().toLowerCase();
  if (username.length < 3) throw new Error("El usuario tiene que tener al menos 3 caracteres.");
  if (username.length > 32) throw new Error("El usuario es demasiado largo.");
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new Error("El usuario solo puede tener letras, números, punto, guion o _.");
  }
  if (RESERVED.has(username)) {
    throw new Error("Ese usuario está reservado. Elegí otro.");
  }
  return username;
}

export function usernameFromEmail(email: string) {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  let base = local.replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "");
  if (base.length < 3) base = `alu${base}`.replace(/[^a-z0-9._-]/g, "");
  if (base.length < 3) base = "alumno";
  base = base.slice(0, 24);
  if (RESERVED.has(base) || !/^[a-z0-9._-]+$/.test(base)) {
    base = `alu-${base}`.replace(/[^a-z0-9._-]/g, "-").slice(0, 32);
  }
  if (base.length < 3) base = "alumno";
  return base;
}

export function parsePassword(raw: string) {
  if (raw.length < 4) throw new Error("La contraseña tiene que tener al menos 4 caracteres.");
  if (raw.length > 72) throw new Error("La contraseña es demasiado larga.");
  return raw;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
