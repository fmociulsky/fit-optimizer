"use server";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, studioMemberships, studios } from "@/db/schema";
import { todayBillingYmd } from "@/lib/client-account";

const BLOCKED_MESSAGE =
  "Este gimnasio no tiene el servicio de Enforma activo. Consultá con administración.";

function ownerBlocked(row: {
  role: string;
  serviceActive: boolean;
  serviceEndsOn: string;
}) {
  if (row.role !== "studio") return false;
  if (!row.serviceActive) return true;
  const ends = row.serviceEndsOn?.trim() ?? "";
  if (ends && ends < todayBillingYmd()) return true;
  return false;
}

/** Bloqueo del dueño de un gimnasio contratado (cuenta role=studio). */
export async function studioOwnerAccessError(
  ownerUserId: string
): Promise<string | null> {
  const [row] = await getDb()
    .select({
      role: accounts.role,
      serviceActive: accounts.serviceActive,
      serviceEndsOn: accounts.serviceEndsOn,
    })
    .from(accounts)
    .where(eq(accounts.userId, ownerUserId))
    .limit(1);
  if (!row) return null;
  return ownerBlocked(row) ? BLOCKED_MESSAGE : null;
}

/**
 * Si el usuario es estudio, profesor o alumno de un gimnasio desactivado/vencido,
 * devuelve el mensaje de error. Demo sin contrato (sin fecha) sigue OK.
 */
export async function gymServiceAccessError(
  userId: string
): Promise<string | null> {
  const db = getDb();
  const [account] = await db
    .select({
      role: accounts.role,
      serviceActive: accounts.serviceActive,
      serviceEndsOn: accounts.serviceEndsOn,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!account) return null;
  if (account.role === "admin") return null;
  if (account.role === "studio") {
    return ownerBlocked(account) ? BLOCKED_MESSAGE : null;
  }

  const memberships = await db
    .select({ studioId: studioMemberships.studioId })
    .from(studioMemberships)
    .where(eq(studioMemberships.userId, userId));
  if (!memberships.length) return null;

  const studioIds = [...new Set(memberships.map((item) => item.studioId))];
  const branchRows = await db
    .select({
      id: studios.id,
      ownerUserId: studios.ownerUserId,
    })
    .from(studios)
    .where(inArray(studios.id, studioIds));
  if (!branchRows.length) return null;

  const ownerIds = [...new Set(branchRows.map((item) => item.ownerUserId))];
  const owners = await db
    .select({
      userId: accounts.userId,
      role: accounts.role,
      serviceActive: accounts.serviceActive,
      serviceEndsOn: accounts.serviceEndsOn,
    })
    .from(accounts)
    .where(
      and(inArray(accounts.userId, ownerIds), eq(accounts.role, "studio"))
    );

  if (!owners.length) return null;
  const anyOpen = owners.some((owner) => !ownerBlocked(owner));
  return anyOpen ? null : BLOCKED_MESSAGE;
}
