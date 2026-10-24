"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, PauseCircle, Wallet } from "lucide-react";
import {
  formatBillingYmd,
  formatClientFee,
} from "@/lib/client-account";
import { CLIENT_PAYMENT_STATUS_LABEL } from "@/lib/labels";
import {
  loadClientBillingHome,
  type ClientBillingHome,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

function statusCopy(billing: ClientBillingHome) {
  const ends = formatBillingYmd(billing.serviceEndsOn);
  const plan =
    billing.planLabel !== "—"
      ? billing.planLabel
      : CLIENT_PAYMENT_STATUS_LABEL[billing.paymentStatus];
  const fee = formatClientFee(billing.feeAmount);

  if (billing.paymentStatus === "paused") {
    return {
      title: "Cuota pausada",
      detail: ends ? `Estaba vigente hasta el ${ends}.` : "Tu cuenta está en pausa.",
      tone: "muted" as const,
      Icon: PauseCircle,
    };
  }
  if (billing.paymentStatus === "comp") {
    return {
      title: "Cortesía",
      detail: ends ? `Vigente hasta el ${ends}.` : "Sin cargo por ahora.",
      tone: "ok" as const,
      Icon: CheckCircle2,
    };
  }
  if (
    billing.paymentStatus === "overdue" ||
    billing.alert === "expired"
  ) {
    return {
      title: "Pago vencido",
      detail: ends
        ? `Venció el ${ends}${plan !== "—" ? ` · ${plan}` : ""}${fee ? ` · ${fee}` : ""}.`
        : "Tu cuota figura con deuda. Consultá en recepción.",
      tone: "danger" as const,
      Icon: AlertTriangle,
    };
  }
  if (billing.alert === "due_soon") {
    return {
      title: "Cuota por vencer",
      detail: ends
        ? `Vence el ${ends}${plan !== "—" ? ` · ${plan}` : ""}${fee ? ` · ${fee}` : ""}.`
        : "Renová pronto para no interrumpir tus clases.",
      tone: "warn" as const,
      Icon: AlertTriangle,
    };
  }
  if (!billing.serviceEndsOn && !billing.planName) {
    return {
      title: "Sin plan de pago cargado",
      detail: "Cuando el gimnasio te asigne la cuota, la ves acá.",
      tone: "muted" as const,
      Icon: Wallet,
    };
  }
  return {
    title: "Cuota al día",
    detail: ends
      ? `Vence el ${ends}${plan !== "—" ? ` · ${plan}` : ""}${fee ? ` · ${fee}` : ""}.`
      : `${plan}${fee ? ` · ${fee}` : ""}`,
    tone: "ok" as const,
    Icon: CheckCircle2,
  };
}

const toneClass = {
  ok: "border-emerald-600/40 bg-emerald-500/20 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-500/25 dark:text-emerald-50",
  warn: "border-amber-500/30 bg-amber-500/10",
  danger:
    "border-red-700/60 bg-red-600/25 text-red-950 dark:border-red-400/50 dark:bg-red-600/35 dark:text-red-50",
  muted: "border-foreground/8 bg-card",
} as const;

const iconClass = {
  ok: "text-emerald-700 dark:text-emerald-300",
  warn: "text-amber-700 dark:text-amber-400",
  danger: "text-red-700 dark:text-red-300",
  muted: "text-muted-foreground",
} as const;

const detailClass = {
  ok: "text-emerald-900/80 dark:text-emerald-100/80",
  warn: "text-muted-foreground",
  danger: "text-red-900/85 dark:text-red-100/85",
  muted: "text-muted-foreground",
} as const;

export function ClientBillingHomeCard() {
  const [billing, setBilling] = useState<
    ClientBillingHome | null | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadClientBillingHome()
      .then((next) => {
        if (!cancelled) setBilling(next);
      })
      .catch(() => {
        if (!cancelled) setBilling(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (billing === undefined) {
    return (
      <div className="mt-4 rounded-2xl border border-foreground/8 bg-card px-4 py-3 text-sm text-muted-foreground">
        Cargando tu cuota…
      </div>
    );
  }

  if (!billing) return null;

  const copy = statusCopy(billing);
  const Icon = copy.Icon;

  return (
    <section
      className={cn(
        "mt-4 flex gap-3 rounded-2xl border px-4 py-4",
        toneClass[copy.tone]
      )}
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", iconClass[copy.tone])}
      />
      <div className="min-w-0">
        <p className="font-medium">{copy.title}</p>
        <p className={cn("mt-0.5 text-sm", detailClass[copy.tone])}>
          {copy.detail}
        </p>
      </div>
    </section>
  );
}
