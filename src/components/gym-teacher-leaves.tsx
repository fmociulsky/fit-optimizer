"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatBillingYmd } from "@/lib/client-account";
import {
  listLeaveReplacementTeachers,
  listPendingTeacherLeaves,
  resolveTeacherLeave,
  type LeaveReplacementOption,
  type TeacherLeaveView,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function rangeLabel(startsOn: string, endsOn: string) {
  if (startsOn === endsOn) return formatBillingYmd(startsOn);
  return `${formatBillingYmd(startsOn)} → ${formatBillingYmd(endsOn)}`;
}

export function GymTeacherLeavesPanel() {
  const [rows, setRows] = useState<TeacherLeaveView[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replacements, setReplacements] = useState<
    Record<string, LeaveReplacementOption[]>
  >({});
  const [chosen, setChosen] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void listPendingTeacherLeaves()
      .then(async (next) => {
        if (cancelled) return;
        setRows(next);
        const map: Record<string, LeaveReplacementOption[]> = {};
        const picks: Record<string, string> = {};
        await Promise.all(
          next.map(async (row) => {
            const options = await listLeaveReplacementTeachers(
              row.teacherUserId
            );
            map[row.id] = options;
            if (options[0]) picks[row.id] = options[0].userId;
          })
        );
        if (!cancelled) {
          setReplacements(map);
          setChosen(picks);
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function resolve(
    row: TeacherLeaveView,
    decision: "approved" | "rejected"
  ) {
    setBusyId(row.id);
    try {
      const next = await resolveTeacherLeave({
        leaveId: row.id,
        decision,
        replacementTeacherUserId:
          decision === "approved" ? chosen[row.id] ?? null : null,
      });
      setRows(next);
      toast.success(
        decision === "approved"
          ? "Licencia confirmada. El reemplazo ya figura en la agenda."
          : "Licencia rechazada."
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null) return null;

  return (
    <section className="rounded-3xl border border-foreground/8 bg-card p-5">
      <p className="font-medium">Licencias</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Pedidos de ausencias por un período. Confirmá y elegí quién cubre, o
        rechazá.
      </p>
      {!rows.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No hay licencias pendientes.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8">
          {rows.map((row) => {
            const options = replacements[row.id] ?? [];
            return (
              <li key={row.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{row.teacherName}</p>
                  <p className="text-sm text-muted-foreground">
                    {rangeLabel(row.startsOn, row.endsOn)}
                  </p>
                </div>
                {row.note ? (
                  <p className="text-sm text-muted-foreground">{row.note}</p>
                ) : null}
                {options.length === 0 ? (
                  <p className="text-sm text-destructive">
                    No hay otro profesor activo para cubrir.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor={`leave-cover-${row.id}`}>Reemplazo</Label>
                    <select
                      id={`leave-cover-${row.id}`}
                      className="h-11 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
                      value={chosen[row.id] ?? ""}
                      onChange={(event) =>
                        setChosen((current) => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                    >
                      {options.map((item) => (
                        <option key={item.userId} value={item.userId}>
                          {item.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-10 px-4"
                    disabled={
                      busyId === row.id ||
                      options.length === 0 ||
                      !chosen[row.id]
                    }
                    onClick={() => void resolve(row, "approved")}
                  >
                    {busyId === row.id ? "Guardando…" : "Confirmar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 px-4"
                    disabled={busyId === row.id}
                    onClick={() => void resolve(row, "rejected")}
                  >
                    Rechazar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
