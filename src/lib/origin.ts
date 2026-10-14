import { headers } from "next/headers";

export async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
