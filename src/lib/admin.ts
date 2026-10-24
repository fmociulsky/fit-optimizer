"use server";

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, studios } from "@/db/schema";
import { formatBillingYmd, todayBillingYmd } from "@/lib/client-account";
import {
  hashPassword,
  parsePassword,
  parseUsername,
} from "@/lib/password";
import { createStudioCode } from "@/lib/roles";
import type {
  ContractedStudioDetail,
  ContractedStudioSummary,
  StudioServicePaymentStatus,
} from "@/lib/admin-types";
import { getSessionUserId } from "@/lib/session";

export type {
  ContractedStudioDetail,
  ContractedStudioSummary,
  StudioServicePaymentStatus,
};

async function requireAdminUserId() {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("No hay sesión");
  const [row] = await getDb()
    .select({ role: accounts.role })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (row?.role !== "admin") {
    throw new Error("No tenés permiso de administración.");
  }
  return userId;
}

async function uniqueStudioAccountCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createStudioCode();
    const [taken] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.code, code))
      .limit(1);
    if (!taken) return code;
  }
  throw new Error("No se pudo crear un código de estudio.");
}

function parseServiceDate(raw: string, label: string) {
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Pon una fecha de ${label} válida.`);
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Pon una fecha de ${label} válida.`);
  }
  return value;
}

function parseServiceFee(raw: number | string) {
  const n =
    typeof raw === "number" ? raw : Number(String(raw).replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Pon el valor del servicio.");
  }
  if (n > 99_999_999) throw new Error("El valor del servicio es demasiado alto.");
  return Math.round(n);
}

function parseMaxBranches(raw: number | string) {
  const n =
    typeof raw === "number" ? raw : Number(String(raw).replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("Pon al menos 1 sucursal permitida.");
  }
  if (n > 200) throw new Error("El máximo de sucursales es demasiado alto.");
  return Math.round(n);
}

function parseOptionalEmail(raw: string, label: string) {
  const email = raw.trim().toLowerCase();
  if (!email) return "";
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Pon un ${label} válido.`);
  }
  return email;
}

function parseOptionalPhone(raw: string, label: string) {
  const phone = raw.trim();
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) throw new Error(`Pon un ${label} válido.`);
  return phone;
}

function normalizePaymentStatus(
  raw: string | null | undefined
): StudioServicePaymentStatus {
  return raw === "overdue" ? "overdue" : "current";
}

function toSummary(
  row: typeof accounts.$inferSelect,
  branchCount: number
): ContractedStudioSummary {
  const ends = row.serviceEndsOn ?? "";
  const today = todayBillingYmd();
  const expired = Boolean(ends && ends < today);
  const stored = normalizePaymentStatus(row.servicePaymentStatus);
  const servicePaymentStatus: StudioServicePaymentStatus =
    expired || stored === "overdue" ? "overdue" : "current";
  return {
    userId: row.userId,
    gymName: row.name || "Gimnasio",
    username: row.username ?? "",
    email: row.email ?? "",
    code: row.code,
    branchCount,
    maxBranches: Math.max(1, row.maxBranches ?? 1),
    serviceActive: row.serviceActive !== false,
    serviceStartsOn: row.serviceStartsOn ?? "",
    serviceEndsOn: ends,
    serviceFeeAmount: row.serviceFeeAmount ?? null,
    servicePaymentStatus,
    serviceLastPaidOn: row.serviceLastPaidOn ?? "",
    paymentDue: servicePaymentStatus === "overdue",
    expired,
    contactName: row.contactName ?? "",
    contactPhone: row.contactPhone ?? "",
    contactEmail: row.contactEmail ?? "",
    createdAt: row.createdAt?.toISOString?.() ?? "",
  };
}

/** Lista los gimnasios contratados (cuentas role=studio). */
export async function listContractedStudios(): Promise<
  ContractedStudioSummary[]
> {
  await requireAdminUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.role, "studio"))
    .orderBy(desc(accounts.createdAt));
  if (!rows.length) return [];
  const ownerIds = rows.map((item) => item.userId);
  const branches = await db
    .select({ ownerUserId: studios.ownerUserId })
    .from(studios)
    .where(inArray(studios.ownerUserId, ownerIds));
  const countByOwner = new Map<string, number>();
  for (const branch of branches) {
    countByOwner.set(
      branch.ownerUserId,
      (countByOwner.get(branch.ownerUserId) ?? 0) + 1
    );
  }
  return rows.map((row) =>
    toSummary(row, countByOwner.get(row.userId) ?? 0)
  );
}

export async function getContractedStudio(
  studioUserId: string
): Promise<ContractedStudioDetail | null> {
  await requireAdminUserId();
  const db = getDb();
  const [row] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, studioUserId))
    .limit(1);
  if (!row || row.role !== "studio") return null;
  const branches = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, studioUserId));
  return toSummary(row, branches.length);
}

/** Alta de un gimnasio que contrata Enforma: crea la cuenta para entrar en Estudio. */
export async function createContractedStudio(input: {
  gymName: string;
  username: string;
  password: string;
  email?: string;
  serviceStartsOn: string;
  serviceEndsOn: string;
  serviceFeeAmount: number | string;
  maxBranches: number | string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}) {
  await requireAdminUserId();
  const gymName = input.gymName.trim();
  if (gymName.length < 2) throw new Error("Pon el nombre del gimnasio.");
  if (gymName.length > 80) throw new Error("El nombre es demasiado largo.");
  const username = parseUsername(input.username);
  const password = parsePassword(input.password);
  const serviceStartsOn = parseServiceDate(input.serviceStartsOn, "inicio");
  const serviceEndsOn = parseServiceDate(input.serviceEndsOn, "vencimiento");
  if (serviceEndsOn < serviceStartsOn) {
    throw new Error("El vencimiento no puede ser anterior al inicio.");
  }
  const serviceFeeAmount = parseServiceFee(input.serviceFeeAmount);
  const maxBranches = parseMaxBranches(input.maxBranches);
  const contactName = input.contactName.trim().slice(0, 80);
  if (contactName.length < 2) {
    throw new Error("Pon el nombre del contacto del estudio.");
  }
  const contactPhone = parseOptionalPhone(
    input.contactPhone,
    "teléfono de contacto"
  );
  if (!contactPhone) throw new Error("Pon el teléfono del contacto.");
  const contactEmail = parseOptionalEmail(
    input.contactEmail ?? "",
    "email de contacto"
  );
  const email = parseOptionalEmail(input.email ?? "", "email de acceso");
  const db = getDb();
  const [usernameTaken] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.username, username))
    .limit(1);
  if (usernameTaken) throw new Error("Ese usuario ya está en uso.");
  if (email) {
    const [emailTaken] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    if (emailTaken) throw new Error("Ese email ya está en uso.");
  }
  const userId = crypto.randomUUID();
  const now = new Date();
  await db.insert(accounts).values({
    userId,
    role: "studio",
    name: gymName,
    username,
    email: email || null,
    passwordHash: await hashPassword(password),
    code: await uniqueStudioAccountCode(),
    linkedProfessionalId: null,
    serviceActive: true,
    serviceStartsOn,
    serviceEndsOn,
    serviceFeeAmount,
    maxBranches,
    servicePaymentStatus: "current",
    serviceLastPaidOn: serviceStartsOn,
    contactName,
    contactPhone,
    contactEmail,
    createdAt: now,
    updatedAt: now,
  });
  return getContractedStudio(userId);
}

/** Actualiza datos del contrato y del contacto del estudio. */
export async function updateContractedStudio(
  studioUserId: string,
  input: {
    gymName: string;
    serviceStartsOn: string;
    serviceEndsOn: string;
    serviceFeeAmount: number | string;
    maxBranches: number | string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
  }
) {
  await requireAdminUserId();
  const db = getDb();
  const [row] = await db
    .select({ userId: accounts.userId, role: accounts.role })
    .from(accounts)
    .where(eq(accounts.userId, studioUserId))
    .limit(1);
  if (!row || row.role !== "studio") {
    throw new Error("No se encontró ese estudio.");
  }
  const gymName = input.gymName.trim();
  if (gymName.length < 2) throw new Error("Pon el nombre del gimnasio.");
  const serviceStartsOn = parseServiceDate(input.serviceStartsOn, "inicio");
  const serviceEndsOn = parseServiceDate(input.serviceEndsOn, "vencimiento");
  if (serviceEndsOn < serviceStartsOn) {
    throw new Error("El vencimiento no puede ser anterior al inicio.");
  }
  const serviceFeeAmount = parseServiceFee(input.serviceFeeAmount);
  const maxBranches = parseMaxBranches(input.maxBranches);
  const existingBranches = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, studioUserId));
  if (maxBranches < existingBranches.length) {
    throw new Error(
      `Ya tiene ${existingBranches.length} sucursal${
        existingBranches.length === 1 ? "" : "es"
      }. El máximo no puede ser menor.`
    );
  }
  const contactName = input.contactName.trim().slice(0, 80);
  if (contactName.length < 2) {
    throw new Error("Pon el nombre del contacto del estudio.");
  }
  const contactPhone = parseOptionalPhone(
    input.contactPhone,
    "teléfono de contacto"
  );
  if (!contactPhone) throw new Error("Pon el teléfono del contacto.");
  const contactEmail = parseOptionalEmail(
    input.contactEmail ?? "",
    "email de contacto"
  );
  await db
    .update(accounts)
    .set({
      name: gymName,
      serviceStartsOn,
      serviceEndsOn,
      serviceFeeAmount,
      maxBranches,
      contactName,
      contactPhone,
      contactEmail,
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, studioUserId));
  return getContractedStudio(studioUserId);
}

/** Activa o desactiva el servicio de un gimnasio contratado. */
export async function setContractedStudioActive(
  studioUserId: string,
  active: boolean
) {
  await requireAdminUserId();
  const db = getDb();
  const [row] = await db
    .select({ userId: accounts.userId, role: accounts.role })
    .from(accounts)
    .where(eq(accounts.userId, studioUserId))
    .limit(1);
  if (!row || row.role !== "studio") {
    throw new Error("No se encontró ese estudio.");
  }
  await db
    .update(accounts)
    .set({
      serviceActive: active,
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, studioUserId));
  return getContractedStudio(studioUserId);
}

/**
 * Registra el cobro del contrato: marca al día y aplica el nuevo vencimiento.
 */
export async function markContractedStudioPaid(
  studioUserId: string,
  serviceEndsOnRaw: string
) {
  await requireAdminUserId();
  const db = getDb();
  const [row] = await db
    .select({ userId: accounts.userId, role: accounts.role })
    .from(accounts)
    .where(eq(accounts.userId, studioUserId))
    .limit(1);
  if (!row || row.role !== "studio") {
    throw new Error("No se encontró ese estudio.");
  }
  const serviceEndsOn = parseServiceDate(serviceEndsOnRaw, "vencimiento");
  const today = todayBillingYmd();
  await db
    .update(accounts)
    .set({
      servicePaymentStatus: "current",
      serviceLastPaidOn: today,
      serviceEndsOn,
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, studioUserId));
  const next = await getContractedStudio(studioUserId);
  if (!next) throw new Error("No se pudo actualizar el pago.");
  return {
    ...next,
    renewedUntilLabel: formatBillingYmd(serviceEndsOn),
  };
}
