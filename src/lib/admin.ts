"use server";

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, studioMemberships, studios, userStates } from "@/db/schema";
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
import type { AppState, PersistedUser } from "@/lib/types";

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

function monthKeyFromDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

/** Claves YYYY-MM de los últimos n meses, el más actual primero. */
function lastNMonthKeys(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    keys.push(monthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

function monthEndDate(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999);
}

function parsePersistedState(payload: unknown): AppState | null {
  if (!payload || typeof payload !== "object") return null;
  const asPersisted = payload as PersistedUser;
  if (asPersisted.state && typeof asPersisted.state === "object") {
    return asPersisted.state;
  }
  const raw = payload as AppState;
  if (raw.profile && raw.goal && raw.plan) return raw;
  return null;
}

function hasNutritionPlan(payload: unknown) {
  const state = parsePersistedState(payload);
  if (!state) return false;
  return Boolean(state.weeklyMenu || state.nutritionPrefs);
}

export type PlatformAdminMonth = {
  key: string;
  label: string;
  /** Estudios dados de alta hasta el cierre del mes. */
  studios: number;
  /** Cobros registrados ese mes (suma de cuotas con último pago en el mes). */
  revenue: number;
  /** Alumnos de estudio dados de alta hasta el cierre del mes. */
  clients: number;
};

export type PlatformAdminStats = {
  months: PlatformAdminMonth[];
  studioCount: number;
  clientCount: number;
  revenueTotal: number;
  nutritionWithPlan: number;
  nutritionWithoutPlan: number;
};

/** Estadísticas de plataforma: estudios, ingresos, alumnos y uso de nutrición. */
export async function loadPlatformAdminStats(): Promise<PlatformAdminStats> {
  await requireAdminUserId();
  const db = getDb();
  const monthKeys = lastNMonthKeys(12);

  const studioRows = await db
    .select({
      userId: accounts.userId,
      createdAt: accounts.createdAt,
      serviceFeeAmount: accounts.serviceFeeAmount,
      serviceLastPaidOn: accounts.serviceLastPaidOn,
    })
    .from(accounts)
    .where(eq(accounts.role, "studio"));

  const clientRows = await db
    .select({
      userId: studioMemberships.userId,
      createdAt: studioMemberships.createdAt,
    })
    .from(studioMemberships)
    .where(eq(studioMemberships.role, "client"));

  const months: PlatformAdminMonth[] = monthKeys.map((key) => {
    const end = monthEndDate(key);
    const studiosCount = studioRows.filter(
      (row) => row.createdAt && row.createdAt.getTime() <= end.getTime()
    ).length;
    const clientsCount = new Set(
      clientRows
        .filter((row) => row.createdAt && row.createdAt.getTime() <= end.getTime())
        .map((row) => row.userId)
    ).size;
    const revenue = studioRows.reduce((sum, row) => {
      const paid = row.serviceLastPaidOn?.trim() ?? "";
      if (!paid.startsWith(key)) return sum;
      return sum + (row.serviceFeeAmount ?? 0);
    }, 0);
    return {
      key,
      label: monthLabel(key),
      studios: studiosCount,
      revenue,
      clients: clientsCount,
    };
  });

  const clientIds = [...new Set(clientRows.map((row) => row.userId))];
  let nutritionWithPlan = 0;
  if (clientIds.length) {
    const states = await db
      .select({
        userId: userStates.userId,
        payload: userStates.payload,
      })
      .from(userStates)
      .where(inArray(userStates.userId, clientIds));
    const withPlan = new Set(
      states
        .filter((row) => hasNutritionPlan(row.payload))
        .map((row) => row.userId)
    );
    nutritionWithPlan = withPlan.size;
  }
  const clientCount = clientIds.length;
  const nutritionWithoutPlan = Math.max(0, clientCount - nutritionWithPlan);
  const revenueTotal = months.reduce((sum, month) => sum + month.revenue, 0);

  return {
    months,
    studioCount: studioRows.length,
    clientCount,
    revenueTotal,
    nutritionWithPlan,
    nutritionWithoutPlan,
  };
}
