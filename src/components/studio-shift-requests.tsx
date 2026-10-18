"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/labels";
import {
  listPendingShiftRequests,
  resolveShiftRequest,
  type StudioShiftRequestView,
} from "@/lib/studio";
import type { ProposedTeacherShift } from "@/db/schema";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function formatShifts(shifts: ProposedTeacherShift[]) {
  if (!shifts.length) return "Sin días asignados";
  return [...shifts]
    .sort((a, b) => a.weekday - b.weekday)
    .map((item) => {
      const day =
        WEEKDAYS.find((entry) => entry.id === item.weekday)?.short ??
        `D${item.weekday}`;
      return `${day} ${item.startHour}–${item.endHour}`;
    })
    .join(" · ");
}

export function StudioShiftRequestsPanel() {
  const [rows, setRows] = useState<StudioShiftRequestView[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPendingShiftRequests()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function resolve(
    requestId: string,
    decision: "approved" | "rejected"
  ) {
    setBusyId(requestId);
    try {
      setRows(await resolveShiftRequest(requestId, decision));
      toast.success(
        decision === "approved" ? "Horario aprobado." : "Pedido rechazado."
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  if (!rows?.length) return null;

  return (
    <section className="mt-8 rounded-3xl border border-foreground/8 bg-card p-5">
      <p className="font-medium">Solicitud de cambio de horario</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Los profesores pidieron cambiar sus días. Aprobá o rechazá cada una.
      </p>
      <ul className="mt-4 divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8">
        {rows.map((row) => (
          <li key={row.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{row.teacherName}</p>
              <p className="text-sm text-muted-foreground">{row.studioName}</p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ahora
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatShifts(row.currentShifts)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  Solicitud
                </p>
                <p className="mt-1 font-medium">
                  {formatShifts(row.proposedShifts)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-10 px-4"
                disabled={busyId === row.id}
                onClick={() => void resolve(row.id, "approved")}
              >
                {busyId === row.id ? "Guardando…" : "Aprobar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4"
                disabled={busyId === row.id}
                onClick={() => void resolve(row.id, "rejected")}
              >
                Rechazar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
