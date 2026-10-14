"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useAppStore } from "@/components/app-provider";
import { WEEKDAYS } from "@/lib/labels";
import {
  listAssignedTeacherClients,
  type TeacherAssignedClient,
} from "@/lib/studio";

function weekdayShort(id: number) {
  return WEEKDAYS.find((item) => item.id === id)?.short ?? "Día";
}

function daysSummary(client: TeacherAssignedClient) {
  if (client.reservations.length) {
    return client.reservations
      .map((item) => `${weekdayShort(item.weekday)} ${item.slotStart}`)
      .join(" · ");
  }
  if (client.sessionsPerWeek == null) return "Sin días cargados";
  return client.sessionsPerWeek === 1
    ? "1 día por semana"
    : `${client.sessionsPerWeek} días por semana`;
}

export function ProfessionalHome() {
  const { ready, account } = useAppStore();
  const [clients, setClients] = useState<TeacherAssignedClient[] | null>(null);

  useEffect(() => {
    if (!ready || account?.role !== "professional") return;
    let cancelled = false;
    void listAssignedTeacherClients()
      .then((rows) => {
        if (!cancelled) setClients(rows);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [account?.role, ready]);

  const grouped = useMemo(() => {
    const map = new Map<string, TeacherAssignedClient[]>();
    for (const client of clients ?? []) {
      const current = map.get(client.studioName) ?? [];
      current.push(client);
      map.set(client.studioName, current);
    }
    return [...map.entries()];
  }, [clients]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando…
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
          Tus alumnos.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          El gimnasio te asigna alumnos. Entrá a cada uno para cargarle el plan
          de ejercicios. Los días y horas de sucursal los cargas en Sucursales.
        </p>

        <div className="mt-8 flex items-center justify-between gap-3">
          <h2 className="font-heading text-2xl italic">Alumnos</h2>
          {clients && (
            <p className="text-sm text-muted-foreground">
              {clients.length} asignado{clients.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {clients === null && (
          <p className="mt-4 text-sm text-muted-foreground">Cargando alumnos…</p>
        )}

        {clients && clients.length === 0 && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <Users className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              El gimnasio todavía no te asignó alumnos. Cuando lo haga, salen
              aquí.
            </p>
          </div>
        )}

        {grouped.map(([studioName, rows]) => (
          <div key={studioName} className="mt-4">
            {grouped.length > 1 && (
              <p className="mb-2 text-sm text-muted-foreground">{studioName}</p>
            )}
            <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
              {rows.map((client) => (
                <li key={`${client.studioId}:${client.userId}`}>
                  <Link
                    href={`/profesor/${encodeURIComponent(client.userId)}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{client.displayName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {daysSummary(client)}
                        {" · "}
                        {client.hasPlan ? "Plan cargado" : "Sin plan"}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                      {client.hasPlan ? "Editar plan" : "Cargar plan"}
                      <ChevronRight className="size-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </div>
  );
}
