import type { AccountRole } from "@/lib/types";

export type { AccountRole };

export function isProfessionalRole(role?: string | null) {
  return role === "professional";
}

export function isClientRole(role?: string | null) {
  return role === "client";
}

export function isStudioRole(role?: string | null) {
  return role === "studio";
}

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createProfessionalCode() {
  return createPrefixedCode("ENF");
}

export function createStudioCode() {
  return createPrefixedCode("EST");
}

export function createInviteCode(kind: "teacher" | "client") {
  return createPrefixedCode(kind === "teacher" ? "PRF" : "ALU");
}

function createPrefixedCode(prefix: string) {
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    body += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${prefix}-${body}`;
}

export function normalizeProfessionalCode(raw: string) {
  return normalizePrefixedCode(raw, "ENF");
}

export function normalizeJoinCode(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("EST")) return normalizePrefixedCode(raw, "EST");
  if (compact.startsWith("PRF")) return normalizePrefixedCode(raw, "PRF");
  if (compact.startsWith("ALU")) return normalizePrefixedCode(raw, "ALU");
  if (compact.startsWith("ENF")) return normalizePrefixedCode(raw, "ENF");
  return normalizePrefixedCode(raw, "ALU");
}

function normalizePrefixedCode(raw: string, prefix: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  const body = compact.startsWith(prefix) ? compact.slice(prefix.length) : compact;
  return body ? `${prefix}-${body}` : "";
}

export const CLIENT_PATHS = [
  "/panel",
  "/agenda",
  "/nutricion",
  "/mente",
  "/comenzar",
  "/turnos",
  "/datos",
];

export function isClientPath(pathname: string) {
  return CLIENT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function isProfessionalPath(pathname: string) {
  return pathname === "/profesor" || pathname.startsWith("/profesor/");
}

export function isStudioPath(pathname: string) {
  return pathname === "/estudio" || pathname.startsWith("/estudio/");
}

export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function clientHomeHref(
  account?: {
    role?: string | null;
    studioRole?: string | null;
  } | null,
  hasPlan = false
) {
  if (account?.role === "admin") return "/admin/estudios";
  if (account?.role === "professional" || account?.studioRole === "teacher") {
    return "/profesor";
  }
  if (account?.role === "studio") return "/estudio";
  if (account?.studioRole === "client") return "/panel";
  return hasPlan ? "/panel" : "/unirse";
}
