"use client";

import { useEffect, useState } from "react";
import { Clock3, MapPin } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { TeacherHoursEditor } from "@/components/teacher-hours-editor";
import { useAppStore } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/labels";
import {
  cancelOwnTeacherShiftRequest,
  loadTeacherStudioHours,
  requestOwnTeacherShifts,
  type TeacherStudioHours,
} from "@/lib/studio";

function formatProposed(
  shifts: { weekday: number; startHour: string; endHour: string }[]
) {
  if (!shifts.length) return "Sin días";
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cancelar.";
}

export function ProfessionalBranches() {
  const { ready, account } = useAppStore();
  const [studioHours, setStudioHours] = useState<TeacherStudioHours[] | null>(
    null
  );
  const [loadError, setLoadError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || account?.role !== "professional") return;
    let cancelled = false;
    void loadTeacherStudioHours()
      .then((rows) => {
        if (!cancelled) setStudioHours(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las sucursales."
          );
          setStudioHours([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [account?.role, ready]);

  if (!ready || studioHours === null) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando sucursales…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Profesor
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          Sucursales.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Donde el gimnasio te asignó. Si cambiás tus días y horas, el estudio
          tiene que aprobar el pedido.
        </p>

        {loadError ? (
          <p className="mt-6 text-sm text-muted-foreground">{loadError}</p>
        ) : null}

        {studioHours.length === 0 && !loadError && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Todavía no te asignaron a una sucursal. Cuando el gimnasio lo
              haga, cargás acá tus días y horas.
            </p>
          </div>
        )}

        {studioHours.map((row) => {
          const editorShifts = row.pendingRequest
            ? row.pendingRequest.proposedShifts
            : row.shifts;
          return (
            <div
              key={row.studio.id}
              className="mt-6 rounded-2xl border border-foreground/8 bg-card p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {row.studio.name}
                  </p>
                  <p className="font-medium">Tus días y horas</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pedís el cambio; el estudio lo confirma.
                  </p>
                  {row.pendingRequest ? (
                    <div className="mt-3 rounded-xl bg-primary/8 px-3 py-2 text-sm">
                      <p className="font-medium text-primary">
                        Pedido pendiente de aprobación
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {formatProposed(row.pendingRequest.proposedShifts)}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 h-10 px-4"
                        disabled={cancellingId === row.studio.id}
                        onClick={() => {
                          setCancellingId(row.studio.id);
                          void cancelOwnTeacherShiftRequest(row.studio.id)
                            .then((next) => {
                              setStudioHours(next);
                              toast.success(
                                "Pedido cancelado. Quedó el horario anterior."
                              );
                            })
                            .catch((error: unknown) => {
                              toast.error(errorMessage(error));
                            })
                            .finally(() => {
                              setCancellingId(null);
                            });
                        }}
                      >
                        {cancellingId === row.studio.id
                          ? "Cancelando…"
                          : "Cancelar"}
                      </Button>
                    </div>
                  ) : null}
                  <TeacherHoursEditor
                    dayHours={row.studio.dayHours}
                    shifts={editorShifts}
                    saveLabel={
                      row.pendingRequest
                        ? "Actualizar pedido"
                        : "Solicitar cambio"
                    }
                    successMessage="Pedido enviado. El estudio tiene que aprobarlo."
                    onSave={async (next) => {
                      setStudioHours(
                        await requestOwnTeacherShifts(row.studio.id, next)
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
