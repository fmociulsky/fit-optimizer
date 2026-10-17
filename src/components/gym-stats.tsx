"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Label } from "@/components/ui/label";
import {
  loadGymRevenueStats,
  seedGymClientBillingSamples,
  type GymRevenueMonth,
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

/** Meses en orden cronológico (más antiguo a la izquierda). */
function chronological(months: GymRevenueMonth[]) {
  return [...months].reverse();
}

function shortMonthLabel(label: string) {
  return label.replace(".", "").split(" ")[0] ?? label;
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

  const monthsAsc = useMemo(
    () => (stats ? chronological(stats.months) : []),
    [stats]
  );

  const maxTotal = useMemo(
    () => Math.max(1, ...monthsAsc.map((item) => item.total)),
    [monthsAsc]
  );

  const maxClients = useMemo(
    () => Math.max(1, ...monthsAsc.map((item) => item.clients)),
    [monthsAsc]
  );

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
              Ingresos y alumnos por mes. Filtrá por sucursal para ver cada sede.
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Ingresos (12 meses)"
            value={formatMoney(stats.total)}
          />
          <StatCard
            label={thisMonth ? `Este mes (${thisMonth.label})` : "Este mes"}
            value={formatMoney(thisMonth?.total ?? 0)}
          />
          <StatCard
            label="Alumnos"
            value={String(stats.clientCount)}
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
            Últimos 12 meses
            {studioId === "all" ? " · todas las sucursales" : ""}.
          </p>
          <VerticalBarChart
            className="mt-6"
            items={monthsAsc.map((month) => ({
              key: month.key,
              label: shortMonthLabel(month.label),
              value: month.total,
              tip: `${month.label}: ${formatMoney(month.total)} · ${
                month.payments === 0
                  ? "sin cobros"
                  : month.payments === 1
                    ? "1 cobro"
                    : `${month.payments} cobros`
              }`,
            }))}
            max={maxTotal}
            formatValue={(value) =>
              value >= 1_000_000
                ? `${Math.round(value / 100_000) / 10}M`
                : value >= 1000
                  ? `${Math.round(value / 1000)}k`
                  : String(value)
            }
          />
          {stats.total === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Todavía no hay cobros en este filtro. Cargá montos en Cuentas o
              marcá pagos con el botón Pagado.
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-foreground/8 bg-card p-5">
          <h2 className="font-heading text-2xl italic">Alumnos por mes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total acumulado al cierre de cada mes
            {studioId === "all" ? " · todas las sucursales" : ""}.
          </p>
          <VerticalBarChart
            className="mt-6"
            tone="secondary"
            items={monthsAsc.map((month) => ({
              key: month.key,
              label: shortMonthLabel(month.label),
              value: month.clients,
              tip: `${month.label}: ${
                month.clients === 1
                  ? "1 alumno"
                  : `${month.clients} alumnos`
              }`,
            }))}
            max={maxClients}
            formatValue={(value) => String(value)}
          />
          {stats.clientCount === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Todavía no hay alumnos en este filtro.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function VerticalBarChart({
  items,
  max,
  formatValue,
  className,
  tone = "primary",
}: {
  items: { key: string; label: string; value: number; tip: string }[];
  max: number;
  formatValue: (value: number) => string;
  className?: string;
  tone?: "primary" | "secondary";
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div
        className="flex h-52 min-w-[28rem] items-end gap-1.5 sm:gap-2"
        role="img"
        aria-label="Gráfico de barras"
      >
        {items.map((item) => {
          const height = Math.round((item.value / max) * 100);
          return (
            <div
              key={item.key}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              title={item.tip}
            >
              <p className="text-[10px] tabular-nums text-muted-foreground sm:text-xs">
                {item.value > 0 ? formatValue(item.value) : ""}
              </p>
              <div className="flex h-40 w-full items-end justify-center">
                <div
                  className={cn(
                    "w-full max-w-10 rounded-t-md transition-all",
                    tone === "primary" ? "bg-primary/80" : "bg-chart-2/70",
                    item.value === 0 && "bg-foreground/10"
                  )}
                  style={{
                    height: `${Math.max(item.value > 0 ? 6 : 2, height)}%`,
                  }}
                />
              </div>
              <p className="truncate text-[10px] capitalize text-muted-foreground sm:text-xs">
                {item.label}
              </p>
            </div>
          );
        })}
      </div>
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
