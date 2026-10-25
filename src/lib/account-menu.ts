"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, studioMemberships } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

export type AccountMenuProfile = {
  label: string;
  avatarUrl: string;
  datosHref: string;
  configHref: string;
  logoutTo: string;
};

/** Foto/logo y rutas del menú de cuenta (estudio, profesor o alumno). */
export async function loadAccountMenuProfile(): Promise<AccountMenuProfile | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const [account] = await getDb()
    .select({
      role: accounts.role,
      name: accounts.name,
      username: accounts.username,
      logoData: accounts.logoData,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!account) return null;
  if (account.role === "admin") return null;

  const label =
    account.username?.trim() ||
    account.name?.trim().split(" ")[0] ||
    (account.role === "studio"
      ? "Estudio"
      : account.role === "professional"
        ? "Profesor"
        : "Alumno");

  let avatarUrl = "";
  if (account.role === "studio") {
    avatarUrl = account.logoData?.trim() || "";
  } else {
    const members = await getDb()
      .select({ photoData: studioMemberships.photoData })
      .from(studioMemberships)
      .where(eq(studioMemberships.userId, userId));
    avatarUrl =
      members.find((item) => item.photoData?.trim())?.photoData?.trim() || "";
  }

  if (account.role === "studio") {
    return {
      label,
      avatarUrl,
      datosHref: "/estudio/datos",
      configHref: "/estudio/configuracion",
      logoutTo: "/",
    };
  }
  if (account.role === "professional") {
    return {
      label,
      avatarUrl,
      datosHref: "/profesor/datos",
      configHref: "/profesor/configuracion",
      logoutTo: "/",
    };
  }
  return {
    label,
    avatarUrl,
    datosHref: "/datos",
    configHref: "/configuracion",
    logoutTo: "/",
  };
}
