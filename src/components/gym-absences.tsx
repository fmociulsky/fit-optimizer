"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Label } from "@/components/ui/label";
import { formatBillingYmd } from "@/lib/client-account";
import {
  listGymAbsenceRanking,
  type GymAbsenceRankingRow,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cargar.";
}

function absenceLabel(count: number) {
  return count === 1 ? "1 ausencia" : `${count} ausencias`;
}

export function GymAbsencesView() {
  const [rows, setRows] = useState<GymAbsenceRankingRow[] | null>(null);
  const [studios, setStudios] = useState<{ id: string; name: string }[]>([]);
  const [monthLabel, setMonthLabel] = useState("");
  const [studioId, setStudioId] = useState("all");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listGymAbsenceRanking(studioId === "all" ? null : studioId)
      .then((next) => {
        if (cancelled) return;
        setRows(next.rows);
        setStudios(next.studios);
        setMonthLabel(next.monthLabel);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [studioId]);

  if (loadError) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando ausencias…
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
            Ausencias.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Alumnos a los que el profesor marcó que no asistieron este mes
            {monthLabel ? ` (${monthLabel})` : ""}, ordenados de mayor a menor.
            No incluye cancelaciones de turno.
          </p>
        </div>

        {studios.length > 1 ? (
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="absences-studio">Sucursal</Label>
            <select
              id="absences-studio"
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
        ) : null}

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-foreground/8 bg-card px-4 py-5 text-sm text-muted-foreground">
            Todavía no hay inasistencias marcadas por profesores este mes.
          </p>
        ) : (
          <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
            {rows.map((row, index) => (
              <li key={`${row.studioId}:${row.userId}`}>
                <Link
                  href={`/estudio/alumnos/${encodeURIComponent(row.userId)}?desde=${encodeURIComponent("/estudio/ausencias")}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                      index === 0
                        ? "bg-amber-400/30 text-amber-950"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-medium">{row.displayName}</span>
                      <span className="text-sm font-medium tabular-nums text-amber-900 dark:text-amber-200">
                        {absenceLabel(row.absenceCount)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {row.studioName}
                      {row.teacherName ? ` · ${row.teacherName}` : ""}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {row.dates.map((ymd) => formatBillingYmd(ymd)).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
