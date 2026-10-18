import type { ClientBillingPlan, ClientPaymentStatus } from "@/lib/types";

export type ClientAccountAlert = "none" | "due_soon" | "expired";

export const CLIENT_BILLING_PLAN_LABEL: Record<ClientBillingPlan, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
};

export const CLIENT_BILLING_PLANS = Object.keys(
  CLIENT_BILLING_PLAN_LABEL
) as ClientBillingPlan[];

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function billingPlanMonths(plan: ClientBillingPlan) {
  if (plan === "quarterly") return 3;
  if (plan === "annual") return 12;
  return 1;
}

export function parseClientBillingPlan(
  raw: string | null | undefined
): ClientBillingPlan | null {
  if (raw === "monthly" || raw === "quarterly" || raw === "annual") return raw;
  if (raw === "Mensual") return "monthly";
  if (raw === "Trimestral") return "quarterly";
  if (raw === "Anual") return "annual";
  return null;
}

export function clientBillingPlanLabel(planName: string) {
  const plan = parseClientBillingPlan(planName);
  if (plan) return CLIENT_BILLING_PLAN_LABEL[plan];
  return planName.trim() || "—";
}

export function formatClientFee(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatBillingYmd(ymd: string) {
  const raw = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${raw}T12:00:00`));
}

/** Texto corto del plan de pago (tipo, monto, vencimiento). */
export function clientPlanSummary(input: {
  planName?: string | null;
  feeAmount?: number | null;
  serviceEndsOn?: string | null;
}) {
  const parts: string[] = [];
  const plan = clientBillingPlanLabel(input.planName ?? "");
  if (plan !== "—") parts.push(plan);
  const fee = formatClientFee(input.feeAmount);
  if (fee) parts.push(fee);
  const ends = formatBillingYmd(input.serviceEndsOn ?? "");
  if (ends) parts.push(`vence ${ends}`);
  return parts.length ? parts.join(" · ") : "Sin plan de pago";
}

/** Suma meses a una fecha YYYY-MM-DD, ajustando días que no existen (31 ene → 28/29 feb). */
export function addMonthsYmd(ymd: string, months: number) {
  const date = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Pon una fecha de inicio válida.");
  }
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Fecha de vencimiento / próximo pago a partir del inicio y el plan. */
export function serviceEndsFromStart(
  startYmd: string,
  plan: ClientBillingPlan
) {
  return addMonthsYmd(startYmd, billingPlanMonths(plan));
}

export function clientAccountAlert(
  paymentStatus: ClientPaymentStatus,
  serviceEndsOn: string
): ClientAccountAlert {
  if (
    paymentStatus === "paused" ||
    paymentStatus === "comp" ||
    !serviceEndsOn
  ) {
    return "none";
  }
  const today = todayYmd();
  if (serviceEndsOn < today) return "expired";
  const limit = new Date(`${today}T12:00:00`);
  limit.setDate(limit.getDate() + 7);
  const limitYmd = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}`;
  if (serviceEndsOn <= limitYmd) return "due_soon";
  return "none";
}

export function todayBillingYmd() {
  return todayYmd();
}

export function shiftYmd(ymd: string, days: number) {
  const date = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha inválida.");
  }
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Al marcar pagado: si todavía no venció, renueva desde el vencimiento actual;
 * si ya venció, renueva desde hoy.
 */
export function renewBillingPeriod(input: {
  today?: string;
  serviceEndsOn: string;
  plan: ClientBillingPlan;
}) {
  const today = input.today ?? todayYmd();
  const periodStart =
    input.serviceEndsOn && input.serviceEndsOn >= today
      ? input.serviceEndsOn
      : today;
  return {
    lastPaidOn: today,
    serviceEndsOn: serviceEndsFromStart(periodStart, input.plan),
    paymentStatus: "current" as const,
  };
}

export function needsPaymentAction(
  paymentStatus: ClientPaymentStatus,
  serviceEndsOn: string
) {
  if (paymentStatus === "paused" || paymentStatus === "comp") return false;
  if (paymentStatus === "overdue") return true;
  const alert = clientAccountAlert(paymentStatus, serviceEndsOn);
  return alert === "expired" || alert === "due_soon";
}
