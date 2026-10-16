"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Label } from "@/components/ui/label";
import {
  loadGymRevenueStats,
  seedGymClientBillingSamples,
  type GymRevenueStats,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cargar.";
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function GymStatsView() {
  const [stats, setStats] = useState<GymRevenueStats | null>(null);
  const [studioId, setStudioId] = useState("all");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await seedGymClientBillingSamples();
        const next = await loadGymRevenueStats(
          studioId === "all" ? null : studioId
        );
        if (cancelled) return;
        setStats(next);
      } catch (error: unknown) {
        if (!cancelled) setLoadError(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studioId]);

  const maxTotal = useMemo(() => {
    if (!stats?.months.length) return 1;
    return Math.max(1, ...stats.months.map((item) => item.total));
  }, [stats]);

  if (loadError) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando estadísticas…
      </div>
    );
  }

  const thisMonth = stats.months[0];
  const prevMonth = stats.months[1];

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Estudio
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
              Estadísticas.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Ingresos por mes según los cobros registrados. Filtrá por sucursal
              para ver cada sede.
            </p>
          </div>
          <div className="space-y-1.5 sm:w-56">
            <Label htmlFor="stats-studio">Sucursal</Label>
            <select
              id="stats-studio"
              className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
              value={studioId}
              onChange={(event) => setStudioId(event.target.value)}
            >
              <option value="all">Todas</option>
              {stats.branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Ingresos (12 meses)"
            value={formatMoney(stats.total)}
          />
          <StatCard
            label={thisMonth ? `Este mes (${thisMonth.label})` : "Este mes"}
            value={formatMoney(thisMonth?.total ?? 0)}
          />
          <StatCard
            label="Pagos pendientes este mes"
            value={formatMoney(stats.pendingTotal)}
            tone="warn"
          />
        </div>

        {prevMonth && thisMonth ? (
          <p className="text-sm text-muted-foreground">
            {thisMonth.total >= prevMonth.total
              ? `Este mes va ${formatMoney(thisMonth.total - prevMonth.total)} arriba de ${prevMonth.label}.`
              : `Este mes va ${formatMoney(prevMonth.total - thisMonth.total)} abajo de ${prevMonth.label}.`}
          </p>
        ) : null}

        <section className="rounded-3xl border border-foreground/8 bg-card p-5">
          <h2 className="font-heading text-2xl italic">Ingresos por mes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Últimos 12 meses · el más actual arriba
            {studioId === "all" ? " · todas las sucursales" : ""}.
          </p>
          <ul className="mt-6 space-y-3">
            {stats.months.map((month) => {
              const width = Math.round((month.total / maxTotal) * 100);
              return (
                <li
                  key={month.key}
                  className="grid gap-1 sm:grid-cols-[6.5rem_1fr_auto] sm:items-center sm:gap-3"
                >
                  <p className="text-sm capitalize text-muted-foreground">
                    {month.label}
                  </p>
                  <div className="h-8 overflow-hidden rounded-full bg-foreground/[0.04]">
                    <div
                      className={cn(
                        "h-full rounded-full bg-primary/80 transition-all",
                        month.total === 0 && "bg-transparent"
                      )}
                      style={{
                        width: `${Math.max(month.total ? 4 : 0, width)}%`,
                      }}
                    />
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium tabular-nums">
                      {formatMoney(month.total)}
                    </p>
                    <p className="text-muted-foreground">
                      {month.payments === 0
                        ? "Sin cobros"
                        : month.payments === 1
                          ? "1 cobro"
                          : `${month.payments} cobros`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {stats.total === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Todavía no hay cobros en este filtro. Cargá montos en Cuentas o
              marcá pagos con el botón Pagado.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-3xl italic tabular-nums",
          tone === "warn" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}
