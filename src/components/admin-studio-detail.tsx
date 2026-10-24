"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/back-link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBillingYmd, formatClientFee } from "@/lib/client-account";
import {
  markContractedStudioPaid,
  setContractedStudioActive,
  updateContractedStudio,
} from "@/lib/admin";
import type { ContractedStudioDetail } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

/** Primer día del mes siguiente (YYYY-MM-DD). */
function firstDayOfNextMonth() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function statusLabel(row: ContractedStudioDetail) {
  if (!row.serviceActive) return { text: "Desactivado", tone: "danger" as const };
  if (row.expired) return { text: "Vencido", tone: "warn" as const };
  return { text: "Activo", tone: "ok" as const };
}

function paymentLabel(row: ContractedStudioDetail) {
  if (row.paymentDue) return { text: "Adeuda", tone: "danger" as const };
  return { text: "Al día", tone: "ok" as const };
}

const statusClass = {
  ok: "text-emerald-800 dark:text-emerald-300",
  warn: "text-amber-800 dark:text-amber-300",
  danger: "text-destructive",
} as const;

export function AdminStudioDetailView({
  studioId,
  initialDetail,
}: {
  studioId: string;
  initialDetail: ContractedStudioDetail | null;
}) {
  const [detail, setDetail] = useState<ContractedStudioDetail | null>(
    initialDetail
  );
  const [gymName, setGymName] = useState(initialDetail?.gymName ?? "");
  const [serviceStartsOn, setServiceStartsOn] = useState(
    initialDetail?.serviceStartsOn ?? ""
  );
  const [serviceEndsOn, setServiceEndsOn] = useState(
    initialDetail?.serviceEndsOn ?? ""
  );
  const [serviceFee, setServiceFee] = useState(
    initialDetail?.serviceFeeAmount != null
      ? String(initialDetail.serviceFeeAmount)
      : ""
  );
  const [maxBranches, setMaxBranches] = useState(
    String(initialDetail?.maxBranches ?? 1)
  );
  const [contactName, setContactName] = useState(
    initialDetail?.contactName ?? ""
  );
  const [contactPhone, setContactPhone] = useState(
    initialDetail?.contactPhone ?? ""
  );
  const [contactEmail, setContactEmail] = useState(
    initialDetail?.contactEmail ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payEndsOn, setPayEndsOn] = useState(firstDayOfNextMonth);

  if (!detail) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-8">
          <BackLink href="/admin/estudios">Volver a estudios</BackLink>
          <h1 className="mt-4 font-heading text-4xl tracking-tight italic">
            Estudio no encontrado.
          </h1>
        </main>
      </div>
    );
  }

  async function save() {
    setBusy(true);
    try {
      const next = await updateContractedStudio(studioId, {
        gymName,
        serviceStartsOn,
        serviceEndsOn,
        serviceFeeAmount: serviceFee,
        maxBranches,
        contactName,
        contactPhone,
        contactEmail,
      });
      if (!next) throw new Error("No se pudo guardar.");
      setDetail(next);
      toast.success("Datos guardados.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    const current = detail;
    if (!current) return;
    const nextActive = !current.serviceActive;
    const ok = window.confirm(
      nextActive
        ? `¿Reactivar ${current.gymName}? Estudio, profesores y alumnos podrán entrar de nuevo.`
        : `¿Desactivar ${current.gymName}? Estudio, profesores y alumnos dejan de poder entrar.`
    );
    if (!ok) return;
    setToggleBusy(true);
    try {
      const next = await setContractedStudioActive(studioId, nextActive);
      if (!next) throw new Error("No se pudo actualizar.");
      setDetail(next);
      toast.success(nextActive ? "Servicio reactivado." : "Servicio desactivado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setToggleBusy(false);
    }
  }

  function openPayDialog() {
    setPayEndsOn(firstDayOfNextMonth());
    setPayOpen(true);
  }

  async function confirmPaid() {
    if (!detail || payBusy) return;
    setPayBusy(true);
    try {
      const next = await markContractedStudioPaid(studioId, payEndsOn);
      setDetail(next);
      setServiceEndsOn(next.serviceEndsOn);
      setPayOpen(false);
      toast.success(
        next.renewedUntilLabel
          ? `Pago registrado. Vence ${next.renewedUntilLabel}.`
          : "Pago registrado."
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPayBusy(false);
    }
  }

  const status = statusLabel(detail);
  const payment = paymentLabel(detail);
  const fee = formatClientFee(detail.serviceFeeAmount);

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <BackLink href="/admin/estudios">Volver a estudios</BackLink>
        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          <h1 className="font-heading text-4xl tracking-tight italic">
            {detail.gymName}.
          </h1>
          <p
            className={cn(
              "text-xs font-medium tracking-wide uppercase",
              statusClass[status.tone]
            )}
          >
            {status.text}
          </p>
          <p
            className={cn(
              "text-xs font-medium tracking-wide uppercase",
              statusClass[payment.tone]
            )}
          >
            {payment.text}
          </p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Usuario {detail.username || "—"}
          {detail.code ? ` · ${detail.code}` : ""}
          {` · ${detail.branchCount}/${detail.maxBranches} sucursales`}
          {fee ? ` · ${fee}` : ""}
          {detail.serviceStartsOn
            ? ` · desde ${formatBillingYmd(detail.serviceStartsOn)}`
            : ""}
          {detail.serviceEndsOn
            ? ` · vence ${formatBillingYmd(detail.serviceEndsOn)}`
            : ""}
          {detail.serviceLastPaidOn
            ? ` · último pago ${formatBillingYmd(detail.serviceLastPaidOn)}`
            : ""}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-10 px-4"
            disabled={payBusy}
            onClick={openPayDialog}
          >
            Registrar pago
          </Button>
          <Button
            type="button"
            variant={detail.serviceActive ? "destructive" : "outline"}
            className="h-10 px-4"
            disabled={toggleBusy}
            onClick={() => void toggleActive()}
          >
            {toggleBusy
              ? "Guardando…"
              : detail.serviceActive
                ? "Desactivar servicio"
                : "Reactivar servicio"}
          </Button>
        </div>

        <section className="mt-6 space-y-1 rounded-2xl border border-foreground/8 bg-card p-4">
          <p className="font-medium">Estado del pago</p>
          <p className="text-sm text-muted-foreground">
            {payment.text}
            {fee ? ` · ${fee}` : ""}
            {detail.serviceEndsOn
              ? ` · vence ${formatBillingYmd(detail.serviceEndsOn)}`
              : ""}
            {detail.serviceLastPaidOn
              ? ` · cobrado ${formatBillingYmd(detail.serviceLastPaidOn)}`
              : " · sin cobros registrados"}
            .
          </p>
          <p className="text-sm text-muted-foreground">
            Al registrar un pago se marca al día y podés elegir la nueva fecha
            de vencimiento (por defecto, el 1.º del mes siguiente).
          </p>
        </section>

        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent className="sm:max-w-md" showCloseButton={!payBusy}>
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl italic">
                Registrar pago
              </DialogTitle>
              <DialogDescription>
                {fee
                  ? `Cobro de ${fee} para ${detail.gymName}. Confirmá la nueva fecha de vencimiento.`
                  : `Confirmá la nueva fecha de vencimiento para ${detail.gymName}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ends">Nueva fecha de vencimiento</Label>
              <Input
                id="pay-ends"
                type="date"
                className="h-11 text-base"
                value={payEndsOn}
                disabled={payBusy}
                onChange={(event) => setPayEndsOn(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Por defecto: primer día del mes siguiente.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4"
                disabled={payBusy}
                onClick={() => setPayOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-10 px-4"
                disabled={payBusy || !payEndsOn}
                onClick={() => void confirmPaid()}
              >
                {payBusy ? "Confirmando…" : "Confirmar pago"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <form
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <section className="space-y-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Contrato</p>
            <div className="space-y-1.5">
              <Label htmlFor="detail-gym-name">Nombre del gimnasio</Label>
              <Input
                id="detail-gym-name"
                className="h-11 text-base"
                value={gymName}
                onChange={(event) => setGymName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="detail-starts">Inicio</Label>
                <Input
                  id="detail-starts"
                  type="date"
                  className="h-11 text-base"
                  value={serviceStartsOn}
                  onChange={(event) => setServiceStartsOn(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-ends">Vence el</Label>
                <Input
                  id="detail-ends"
                  type="date"
                  className="h-11 text-base"
                  value={serviceEndsOn}
                  onChange={(event) => setServiceEndsOn(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-fee">Valor del servicio (ARS)</Label>
                <Input
                  id="detail-fee"
                  type="number"
                  min={1}
                  step={1}
                  className="h-11 text-base"
                  value={serviceFee}
                  onChange={(event) => setServiceFee(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-branches">Sucursales permitidas</Label>
                <Input
                  id="detail-branches"
                  type="number"
                  min={1}
                  step={1}
                  className="h-11 text-base"
                  value={maxBranches}
                  onChange={(event) => setMaxBranches(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Ahora usa {detail.branchCount} de {detail.maxBranches}.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Contacto del estudio</p>
            <p className="text-sm text-muted-foreground">
              Datos personales de quien administra el contrato.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="detail-contact-name">Nombre</Label>
              <Input
                id="detail-contact-name"
                className="h-11 text-base"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="detail-contact-phone">Teléfono</Label>
                <Input
                  id="detail-contact-phone"
                  className="h-11 text-base"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-contact-email">Email</Label>
                <Input
                  id="detail-contact-email"
                  type="email"
                  className="h-11 text-base"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
            </div>
          </section>

          <Button className="h-11 px-5" disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </main>
    </div>
  );
}
