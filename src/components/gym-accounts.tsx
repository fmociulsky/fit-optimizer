"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_BILLING_PLAN_LABEL,
  CLIENT_BILLING_PLANS,
  clientBillingPlanLabel,
  needsPaymentAction,
  parseClientBillingPlan,
  serviceEndsFromStart,
} from "@/lib/client-account";
import { CLIENT_PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { matchesSearch } from "@/lib/search";
import {
  listGymClientAccounts,
  listOwnedBranches,
  markGymClientPaid,
  seedGymClientBillingSamples,
  updateGymClientAccount,
  type GymClientAccount,
} from "@/lib/studio";
import type { ClientBillingPlan, ClientPaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function formatFee(amount: number | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ymd: string) {
  if (!ymd) return "—";
  const date = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusBadge(row: GymClientAccount) {
  if (row.paymentStatus === "overdue" || row.alert === "expired") {
    return (
      <Badge variant="destructive">
        {row.alert === "expired" && row.paymentStatus !== "overdue"
          ? "Vencido"
          : CLIENT_PAYMENT_STATUS_LABEL[row.paymentStatus]}
      </Badge>
    );
  }
  if (row.alert === "due_soon") {
    return <Badge variant="secondary">Por vencer</Badge>;
  }
  if (row.paymentStatus === "paused") {
    return <Badge variant="outline">Pausado</Badge>;
  }
  if (row.paymentStatus === "trial") {
    return <Badge variant="secondary">Prueba</Badge>;
  }
  if (row.paymentStatus === "comp") {
    return <Badge variant="outline">Cortesía</Badge>;
  }
  return <Badge>Al día</Badge>;
}

type Draft = {
  paymentStatus: ClientPaymentStatus;
  serviceEndsOn: string;
  lastPaidOn: string;
  billingPlan: ClientBillingPlan | null;
  feeAmount: string;
  billingNotes: string;
};

function draftFrom(row: GymClientAccount): Draft {
  return {
    paymentStatus: row.paymentStatus,
    serviceEndsOn: row.serviceEndsOn,
    lastPaidOn: row.lastPaidOn,
    billingPlan: parseClientBillingPlan(row.planName),
    feeAmount: row.feeAmount === null ? "" : String(row.feeAmount),
    billingNotes: row.billingNotes,
  };
}

function withRecalculatedEnd(draft: Draft): Draft {
  if (!draft.billingPlan || !draft.lastPaidOn) return draft;
  try {
    return {
      ...draft,
      serviceEndsOn: serviceEndsFromStart(draft.lastPaidOn, draft.billingPlan),
    };
  } catch {
    return draft;
  }
}

export function GymAccountsView() {
  const [rows, setRows] = useState<GymClientAccount[] | null>(null);
  const [studios, setStudios] = useState<{ id: string; name: string }[]>([]);
  const [studioId, setStudioId] = useState("all");
  const [filter, setFilter] = useState<"all" | "attention" | ClientPaymentStatus>(
    "all"
  );
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<GymClientAccount | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await seedGymClientBillingSamples();
        const [accounts, branches] = await Promise.all([
          listGymClientAccounts(),
          listOwnedBranches(),
        ]);
        if (cancelled) return;
        setRows(accounts);
        setStudios(
          branches.map((item) => ({
            id: item.studio.id,
            name: item.studio.name,
          }))
        );
      } catch (error: unknown) {
        if (!cancelled) setLoadError(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function replaceRow(next: GymClientAccount) {
    setRows(
      (current) =>
        (current ?? []).map((item) =>
          item.userId === next.userId && item.studioId === next.studioId
            ? next
            : item
        )
    );
  }

  async function markPaid(row: GymClientAccount) {
    const key = `${row.studioId}:${row.userId}`;
    if (payingId) return;
    setPayingId(key);
    try {
      const next = await markGymClientPaid({
        studioId: row.studioId,
        clientUserId: row.userId,
      });
      replaceRow(next);
      toast.success(
        `Pagado. Próximo vencimiento ${formatDate(next.serviceEndsOn)}.`
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPayingId(null);
    }
  }

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      current: list.filter((item) => item.paymentStatus === "current").length,
      overdue: list.filter(
        (item) =>
          item.paymentStatus === "overdue" || item.alert === "expired"
      ).length,
      dueSoon: list.filter((item) => item.alert === "due_soon").length,
      paused: list.filter((item) => item.paymentStatus === "paused").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows ?? [];
    if (studioId !== "all") {
      list = list.filter((item) => item.studioId === studioId);
    }
    if (filter === "attention") {
      list = list.filter(
        (item) =>
          item.paymentStatus === "overdue" ||
          item.alert === "expired" ||
          item.alert === "due_soon"
      );
    } else if (filter !== "all") {
      list = list.filter((item) => item.paymentStatus === filter);
    }
    return list.filter((item) =>
      matchesSearch(
        query,
        item.displayName,
        item.email,
        item.phone,
        clientBillingPlanLabel(item.planName),
        item.studioName
      )
    );
  }, [rows, studioId, filter, query]);

  function openEdit(row: GymClientAccount) {
    setEditing(row);
    setDraft(draftFrom(row));
  }

  async function save() {
    if (!editing || !draft || busy) return;
    setBusy(true);
    try {
      const feeRaw = draft.feeAmount.trim();
      const feeAmount =
        feeRaw === "" ? null : Number.parseInt(feeRaw.replace(/\D/g, ""), 10);
      const next = await updateGymClientAccount({
        studioId: editing.studioId,
        clientUserId: editing.userId,
        paymentStatus: draft.paymentStatus,
        serviceEndsOn: draft.serviceEndsOn,
        lastPaidOn: draft.lastPaidOn,
        planName: draft.billingPlan ?? "",
        feeAmount:
          feeRaw === ""
            ? null
            : Number.isFinite(feeAmount)
              ? feeAmount
              : null,
        billingNotes: draft.billingNotes,
      });
      replaceRow(next);
      toast.success("Cuenta actualizada.");
      setEditing(null);
      setDraft(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando cuentas…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
        <div>
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Estudio
          </p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
            Cuentas.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Estado de pago de cada alumno, vencimiento del servicio, plan y
            notas. Tocá un alumno para editar.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Alumnos" value={String(stats.total)} />
          <Stat label="Al día" value={String(stats.current)} />
          <Stat label="Deuda / vencido" value={String(stats.overdue)} tone="warn" />
          <Stat label="Por vencer (7 días)" value={String(stats.dueSoon)} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="accounts-search">Buscar</Label>
            <Input
              id="accounts-search"
              className="h-11 text-base"
              placeholder="Nombre, email, plan o sucursal"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:w-44">
            <Label htmlFor="accounts-studio">Sucursal</Label>
            <select
              id="accounts-studio"
              className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
              value={studioId}
              onChange={(event) => setStudioId(event.target.value)}
            >
              <option value="all">Todas</option>
              {studios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:w-44">
            <Label htmlFor="accounts-filter">Estado</Label>
            <select
              id="accounts-filter"
              className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value as
                    | "all"
                    | "attention"
                    | ClientPaymentStatus
                )
              }
            >
              <option value="all">Todos</option>
              <option value="attention">Requieren atención</option>
              <option value="current">Al día</option>
              <option value="overdue">Deuda</option>
              <option value="paused">Pausado</option>
              <option value="trial">Prueba</option>
              <option value="comp">Cortesía</option>
            </select>
          </div>
        </div>

        <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
          {visible.length === 0 && (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              {rows.length === 0
                ? "Todavía no hay alumnos. Crealos en Alumnos."
                : "Ningún alumno coincide con esos filtros."}
            </li>
          )}
          {visible.map((row) => {
            const key = `${row.studioId}:${row.userId}`;
            const showPaid = needsPaymentAction(
              row.paymentStatus,
              row.serviceEndsOn
            );
            return (
              <li key={key}>
                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left transition-colors"
                    onClick={() => openEdit(row)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{row.displayName}</p>
                      {statusBadge(row)}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {row.studioName}
                      {row.teacherName ? ` · ${row.teacherName}` : ""}
                      {row.planName
                        ? ` · ${clientBillingPlanLabel(row.planName)}`
                        : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground sm:hidden">
                      <span>Vence {formatDate(row.serviceEndsOn)}</span>
                      <span>Último pago {formatDate(row.lastPaidOn)}</span>
                      <span className="font-medium text-foreground tabular-nums">
                        {formatFee(row.feeAmount)}
                      </span>
                    </div>
                  </button>
                  <div className="hidden shrink-0 grid-cols-1 gap-y-1 text-sm text-right sm:grid">
                    <p className="text-muted-foreground">
                      Vence {formatDate(row.serviceEndsOn)}
                    </p>
                    <p className="text-muted-foreground">
                      Último pago {formatDate(row.lastPaidOn)}
                    </p>
                    <p className="font-medium tabular-nums">
                      {formatFee(row.feeAmount)}
                    </p>
                  </div>
                  {showPaid ? (
                    <Button
                      type="button"
                      className="h-11 shrink-0 px-5"
                      disabled={payingId === key}
                      onClick={() => void markPaid(row)}
                    >
                      {payingId === key ? "Renovando…" : "Pagado"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </main>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[min(90svh,44rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl italic">
              {editing?.displayName || "Cuenta"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.studioName}${editing.email ? ` · ${editing.email}` : ""}`
                : "Estado de cuenta del alumno."}
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Estado de pago</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(
                    Object.keys(
                      CLIENT_PAYMENT_STATUS_LABEL
                    ) as ClientPaymentStatus[]
                  ).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? { ...current, paymentStatus: status }
                            : current
                        )
                      }
                      className={cn(
                        "rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                        draft.paymentStatus === status
                          ? "border-primary bg-primary/8 ring-1 ring-primary"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      {CLIENT_PAYMENT_STATUS_LABEL[status]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Plan de pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CLIENT_BILLING_PLANS.map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? withRecalculatedEnd({
                                ...current,
                                billingPlan: plan,
                              })
                            : current
                        )
                      }
                      className={cn(
                        "h-11 rounded-xl border text-sm font-medium",
                        draft.billingPlan === plan
                          ? "border-primary bg-primary/8 ring-1 ring-primary"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      {CLIENT_BILLING_PLAN_LABEL[plan]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="account-paid">Inicio / último pago</Label>
                  <Input
                    id="account-paid"
                    type="date"
                    className="h-11 text-base"
                    value={draft.lastPaidOn}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? withRecalculatedEnd({
                              ...current,
                              lastPaidOn: event.target.value,
                            })
                          : current
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-ends">Próximo vencimiento</Label>
                  <Input
                    id="account-ends"
                    type="date"
                    className="h-11 text-base"
                    value={draft.serviceEndsOn}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, serviceEndsOn: event.target.value }
                          : current
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-fee">Monto (ARS)</Label>
                  <Input
                    id="account-fee"
                    className="h-11 text-base"
                    inputMode="numeric"
                    placeholder="0"
                    value={draft.feeAmount}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, feeAmount: event.target.value }
                          : current
                      )
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-notes">Notas</Label>
                <Textarea
                  id="account-notes"
                  rows={3}
                  placeholder="Transferencia pendiente, descuento, acuerdo…"
                  value={draft.billingNotes}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, billingNotes: event.target.value }
                        : current
                    )
                  }
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-5"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setDraft(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="h-11 px-5"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-3xl italic tabular-nums",
          tone === "warn" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}
