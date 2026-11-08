"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBillingYmd, todayBillingYmd } from "@/lib/client-account";
import {
  cancelTeacherLeave,
  requestTeacherLeave,
  type TeacherLeaveView,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function rangeLabel(startsOn: string, endsOn: string) {
  if (startsOn === endsOn) return formatBillingYmd(startsOn);
  return `${formatBillingYmd(startsOn)} → ${formatBillingYmd(endsOn)}`;
}

export function TeacherLeavesSection({
  leaves,
  onLeavesChange,
}: {
  leaves: TeacherLeaveView[] | null;
  onLeavesChange: (next: TeacherLeaveView[]) => void;
}) {
  const today = todayBillingYmd();
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    try {
      const next = await requestTeacherLeave({ startsOn, endsOn, note });
      onLeavesChange(next);
      setNote("");
      toast.success("Licencia enviada. El gimnasio la va a revisar.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(leaveId: string) {
    setBusyId(leaveId);
    try {
      onLeavesChange(await cancelTeacherLeave(leaveId));
      toast.message("Cancelaste el pedido.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-4 rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5">
      <h2 className="font-heading text-2xl italic">Licencias</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Informá un período en el que no vas a dar clases. El gimnasio confirma y
        elige un reemplazo.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="leave-from">Desde</Label>
          <Input
            id="leave-from"
            type="date"
            className="h-11 text-base"
            min={today}
            value={startsOn}
            onChange={(event) => {
              const next = event.target.value;
              setStartsOn(next);
              if (endsOn < next) setEndsOn(next);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leave-to">Hasta</Label>
          <Input
            id="leave-to"
            type="date"
            className="h-11 text-base"
            min={startsOn || today}
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="leave-note">Nota (opcional)</Label>
        <Input
          id="leave-note"
          className="h-11 text-base"
          placeholder="Ej. vacaciones"
          value={note}
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <Button
        type="button"
        className="mt-4 h-10 px-4"
        disabled={busy || !startsOn || !endsOn}
        onClick={() => void submit()}
      >
        {busy ? "Enviando…" : "Pedir licencia"}
      </Button>

      {leaves === null ? (
        <p className="mt-5 text-sm text-muted-foreground">Cargando…</p>
      ) : leaves.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          No tenés licencias pendientes ni próximas.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8">
          {leaves.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {rangeLabel(row.startsOn, row.endsOn)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {row.status === "pending"
                    ? "Pendiente de confirmación"
                    : row.replacementTeacherName
                      ? `Confirmada · reemplazo: ${row.replacementTeacherName}`
                      : "Confirmada"}
                  {row.note ? ` · ${row.note}` : ""}
                </p>
              </div>
              {row.status === "pending" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => void cancel(row.id)}
                >
                  {busyId === row.id ? "Cancelando…" : "Cancelar"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
