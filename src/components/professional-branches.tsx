"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { TeacherHoursEditor } from "@/components/teacher-hours-editor";
import { useAppStore } from "@/components/app-provider";
import { buttonVariants } from "@/components/ui/button";
import {
  loadTeacherStudioHours,
  saveOwnTeacherShifts,
  type TeacherStudioHours,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

export function ProfessionalBranches() {
  const { ready, account } = useAppStore();
  const [studioHours, setStudioHours] = useState<TeacherStudioHours[] | null>(
    null
  );
  const [loadError, setLoadError] = useState("");

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
            error instanceof Error ? error.message : "No se pudieron cargar las sucursales."
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
          Donde el gimnasio te asignó. Cargá tus días y horas dentro de la
          apertura de cada una.
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

        {studioHours.map((row) => (
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
                  Los cargas tú, dentro de la apertura de {row.studio.name}.
                </p>
                <TeacherHoursEditor
                  dayHours={row.studio.dayHours}
                  shifts={row.shifts}
                  saveLabel="Guardar mis días y horas"
                  onSave={async (next) => {
                    setStudioHours(
                      await saveOwnTeacherShifts(row.studio.id, next)
                    );
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <Link
          href="/profesor/alumnos"
          className={cn(buttonVariants({ variant: "ghost" }), "mt-8 h-11 px-4")}
        >
          Volver a alumnos
        </Link>
      </main>
    </div>
  );
}
