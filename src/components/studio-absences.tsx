"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { StudioBranchNav } from "@/components/studio-branch-nav";
import { formatBillingYmd } from "@/lib/client-account";
import { weekdayName } from "@/lib/labels";
import {
  listStudioAbsences,
  loadStudioDashboard,
  type StudioAbsenceView,
  type StudioDashboard,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cargar.";
}

function groupByDate(rows: StudioAbsenceView[]) {
  const map = new Map<string, StudioAbsenceView[]>();
  for (const row of rows) {
    const list = map.get(row.absentOn) ?? [];
    list.push(row);
    map.set(row.absentOn, list);
  }
  return [...map.entries()];
}

export function StudioAbsencesView({ studioId }: { studioId: string }) {
  const [dash, setDash] = useState<StudioDashboard | null>(null);
  const [rows, setRows] = useState<StudioAbsenceView[] | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadStudioDashboard(studioId),
      listStudioAbsences(studioId),
    ])
      .then(([nextDash, nextRows]) => {
        if (cancelled) return;
        setDash(nextDash);
        setRows(nextRows);
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

  if (!dash || rows === null) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando ausencias…
      </div>
    );
  }

  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const upcoming = rows.filter((row) => row.absentOn >= todayYmd);
  const past = rows.filter((row) => row.absentOn < todayYmd);
  const groups = [
    ...groupByDate(upcoming),
    ...groupByDate(past).reverse(),
  ];

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
        <StudioBranchNav
          studioId={studioId}
          name={dash.studio.name}
          active="ausencias"
        />
        <section>
          <h2 className="font-heading text-3xl tracking-tight italic">
            Ausencias
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Alumnos que avisaron que no vienen. El cupo de ese día queda libre.
          </p>

          {rows.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-foreground/8 bg-card px-4 py-5 text-sm text-muted-foreground">
              Nadie avisó ausencia en los últimos días ni en los próximos.
            </p>
          ) : (
            <ul className="mt-6 space-y-6">
              {groups.map(([ymd, items]) => {
                const isPast = ymd < todayYmd;
                const isToday = ymd === todayYmd;
                return (
                  <li key={ymd}>
                    <p
                      className={cn(
                        "text-sm font-medium tracking-wide uppercase",
                        isToday
                          ? "text-primary"
                          : isPast
                            ? "text-muted-foreground"
                            : "text-foreground"
                      )}
                    >
                      {isToday
                        ? "Hoy"
                        : `${weekdayName(items[0]?.weekday ?? 0)} · ${formatBillingYmd(ymd)}`}
                      {isPast ? " · pasado" : null}
                    </p>
                    <ul className="mt-2 divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{item.clientName}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {item.slotStart}
                              {item.teacherName
                                ? ` · ${item.teacherName}`
                                : " · sin profesor"}
                            </p>
                          </div>
                          <p className="text-xs font-medium tracking-wide text-amber-800 uppercase dark:text-amber-300">
                            No va
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
