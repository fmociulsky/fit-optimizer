"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { BackLink } from "@/components/back-link";
import { WorkoutDayCard } from "@/components/workout-day-card";
import {
  loadStudioClientPlan,
  type StudioClientPlanDetail,
} from "@/lib/account";
import {
  GOAL_LABEL,
  MEDICAL_LABEL,
  WEEKDAYS,
  weekdayName,
} from "@/lib/labels";
import { profileAge } from "@/lib/metrics";

export function StudioClientPlanView({
  clientId,
  backHref,
}: {
  clientId: string;
  backHref: string;
}) {
  const [detail, setDetail] = useState<StudioClientPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadStudioClientPlan(clientId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar el plan de entrenamiento."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (error) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl px-4 py-8">
          <BackLink href={backHref}>Volver a alumnos</BackLink>
          <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        </main>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando plan…
      </div>
    );
  }

  const days = [...detail.weeklySplit].sort((a, b) => {
    const order = WEEKDAYS.map((day) => day.id);
    return order.indexOf(a.weekday) - order.indexOf(b.weekday);
  });
  const medical =
    detail.profile.medicalFlags.length &&
    !detail.profile.medicalFlags.includes("none")
      ? detail.profile.medicalFlags.map((flag) => MEDICAL_LABEL[flag]).join(" · ")
      : null;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <BackLink href={backHref}>Volver a alumnos</BackLink>
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Plan de entrenamiento
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
          {detail.displayName}.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {[
            `${profileAge(detail.profile)} años`,
            GOAL_LABEL[detail.goal.type],
            detail.teacherName ? `Profesor ${detail.teacherName}` : null,
            detail.studioNames.length ? detail.studioNames.join(" · ") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {detail.loadedByName ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Cargado por {detail.loadedByName}.
          </p>
        ) : null}
        {medical ? (
          <p className="mt-3 rounded-2xl border border-foreground/8 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Salud: {medical}
            {detail.profile.medicalNotes.trim()
              ? ` · ${detail.profile.medicalNotes.trim()}`
              : ""}
          </p>
        ) : null}

        {!detail.hasPlan ? (
          <p className="mt-8 rounded-2xl border border-foreground/8 bg-card px-4 py-5 text-sm text-muted-foreground">
            Todavía no tiene un plan de entrenamiento cargado. El profesor lo
            arma desde su panel.
          </p>
        ) : (
          <div className="mt-8 space-y-5">
            {days.map((day) => (
              <div key={day.id || `${day.weekday}-${day.name}`}>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  {weekdayName(day.weekday)}
                </p>
                <WorkoutDayCard day={day} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
