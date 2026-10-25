"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import {
  loadPlatformAdminStats,
  type PlatformAdminMonth,
  type PlatformAdminStats,
} from "@/lib/admin";
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

function chronological(months: PlatformAdminMonth[]) {
  return [...months].reverse();
}

function shortMonthLabel(label: string) {
  return label.replace(".", "").split(" ")[0] ?? label;
}

export function AdminStatsView() {
  const [stats, setStats] = useState<PlatformAdminStats | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadPlatformAdminStats()
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const monthsAsc = useMemo(
    () => (stats ? chronological(stats.months) : []),
    [stats]
  );

  const maxStudios = useMemo(
    () => Math.max(1, ...monthsAsc.map((item) => item.studios)),
    [monthsAsc]
  );
  const maxRevenue = useMemo(
    () => Math.max(1, ...monthsAsc.map((item) => item.revenue)),
    [monthsAsc]
  );
  const maxClients = useMemo(
    () => Math.max(1, ...monthsAsc.map((item) => item.clients)),
    [monthsAsc]
  );

  if (loadError) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
        </main>
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
  const nutritionTotal = stats.nutritionWithPlan + stats.nutritionWithoutPlan;
  const withPct =
    nutritionTotal > 0
      ? Math.round((stats.nutritionWithPlan / nutritionTotal) * 100)
      : 0;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Administración
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
              Estadísticas.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Estudios, ingresos y alumnos por mes, más el uso del plan de
              nutrición.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/estudios"
              className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}
            >
              Estudios
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Estudios" value={String(stats.studioCount)} />
          <StatCard
            label={thisMonth ? `Ingresos ${thisMonth.label}` : "Ingresos"}
            value={formatMoney(thisMonth?.revenue ?? 0)}
          />
          <StatCard
            label="Ingresos (12 meses)"
            value={formatMoney(stats.revenueTotal)}
          />
          <StatCard label="Alumnos" value={String(stats.clientCount)} />
        </div>

        <section className="rounded-3xl border border-foreground/8 bg-card p-5">
          <h2 className="font-heading text-2xl italic">Estudios por mes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total acumulado al cierre de cada mes.
          </p>
          <VerticalBarChart
            className="mt-6"
            items={monthsAsc.map((month) => ({
              key: month.key,
              label: shortMonthLabel(month.label),
              value: month.studios,
              tip: `${month.label}: ${
                month.studios === 1
                  ? "1 estudio"
                  : `${month.studios} estudios`
              }`,
            }))}
            max={maxStudios}
            formatValue={(value) => String(value)}
          />
        </section>

        <section className="rounded-3xl border border-foreground/8 bg-card p-5">
          <h2 className="font-heading text-2xl italic">Ingresos por mes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Suma de cuotas de estudios con pago registrado ese mes.
          </p>
          <VerticalBarChart
            className="mt-6"
            items={monthsAsc.map((month) => ({
              key: month.key,
              label: shortMonthLabel(month.label),
              value: month.revenue,
              tip: `${month.label}: ${formatMoney(month.revenue)}`,
            }))}
            max={maxRevenue}
            formatValue={(value) =>
              value >= 1_000_000
                ? `${Math.round(value / 100_000) / 10}M`
                : value >= 1000
                  ? `${Math.round(value / 1000)}k`
                  : String(value)
            }
          />
          {stats.revenueTotal === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Todavía no hay cobros registrados. Usá “Registrar pago” en cada
              estudio.
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-foreground/8 bg-card p-5">
          <h2 className="font-heading text-2xl italic">Alumnos por mes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total acumulado al cierre de cada mes.
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
        </section>

        <section className="rounded-3xl border border-foreground/8 bg-card p-5">
          <div className="flex items-center gap-2">
            <ChartColumn className="size-5 text-primary" />
            <h2 className="font-heading text-2xl italic">
              Alumnos con plan de nutrición
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quiénes ya armaron un menú o preferencias alimenticias en Enforma.
          </p>
          {nutritionTotal === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Todavía no hay alumnos de estudio para medir.
            </p>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
              <div
                className="size-44 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(
                    var(--primary) 0 ${withPct}%,
                    color-mix(in oklab, var(--foreground) 12%, transparent) ${withPct}% 100%
                  )`,
                }}
                role="img"
                aria-label={`${withPct}% con plan de nutrición`}
              />
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-primary" />
                  <span>
                    Con plan de nutrición:{" "}
                    <span className="font-medium tabular-nums">
                      {stats.nutritionWithPlan}
                    </span>{" "}
                    ({withPct}%)
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-foreground/15" />
                  <span>
                    Sin plan de nutrición:{" "}
                    <span className="font-medium tabular-nums">
                      {stats.nutritionWithoutPlan}
                    </span>{" "}
                    ({100 - withPct}%)
                  </span>
                </li>
              </ul>
            </div>
          )}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl italic tabular-nums">{value}</p>
    </div>
  );
}
