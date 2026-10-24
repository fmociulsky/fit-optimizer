"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarOff,
  GraduationCap,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { StudioBranchForm } from "@/components/studio-branch-form";
import { StudioDayAgenda } from "@/components/studio-day-agenda";
import { StudioShiftRequestsPanel } from "@/components/studio-shift-requests";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  getOwnedBranchQuota,
  listOwnedBranches,
  type OwnedBranchQuota,
  type StudioBranchSummary,
} from "@/lib/studio";
import { studioHoursSummary, studioKindsLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function StudioHome() {
  const [rows, setRows] = useState<StudioBranchSummary[] | null>(null);
  const [quota, setQuota] = useState<OwnedBranchQuota | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listOwnedBranches(), getOwnedBranchQuota()])
      .then(([nextRows, nextQuota]) => {
        if (cancelled) return;
        setRows(nextRows);
        setQuota(nextQuota);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las sucursales."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando sucursales…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Gimnasio
          </p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
            Da de alta una sucursal.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Nombre, tipo, dirección, teléfono y los días que abre. Después
            sumás profesores y alumnos en esa sucursal.
            {quota
              ? ` Tu plan permite hasta ${quota.max} sucursal${
                  quota.max === 1 ? "" : "es"
                }.`
              : ""}
          </p>
          <div className="mt-8">
            {quota && !quota.canAdd ? (
              <p className="rounded-xl border border-foreground/8 bg-card px-4 py-3 text-sm text-muted-foreground">
                Alcanzaste el máximo de sucursales de tu contrato. Pedile a
                Enforma ampliar el plan.
              </p>
            ) : (
              <StudioBranchForm embedded />
            )}
          </div>
        </main>
      </div>
    );
  }

  const canAdd = quota?.canAdd !== false;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Gimnasio
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
              Sucursales.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Cada sucursal tiene su horario, profesores y alumnos.
              {quota ? ` Usás ${quota.used} de ${quota.max} permitidas.` : ""}
            </p>
          </div>
          {canAdd ? (
            <Link
              href="/estudio/nueva"
              className={cn(buttonVariants(), "h-11 px-5")}
            >
              <Plus className="size-4" data-icon="inline-start" />
              Nueva sucursal
            </Link>
          ) : (
            <p className="max-w-xs text-sm text-muted-foreground sm:text-right">
              Máximo de sucursales alcanzado. Pedile a Enforma ampliar el plan.
            </p>
          )}
        </div>

        <StudioShiftRequestsPanel />

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <li
              key={row.studio.id}
              className="flex flex-col rounded-3xl border border-foreground/8 bg-card p-5"
            >
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-2xl italic">{row.studio.name}</h2>
                  <Badge variant="secondary" className="mt-2">
                    {studioKindsLabel(row.studio.kinds)}
                  </Badge>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {row.studio.address ? (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {row.studio.address}
                  </p>
                ) : null}
                {row.studio.phone ? (
                  <p className="flex items-start gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0" />
                    {row.studio.phone}
                  </p>
                ) : null}
                <p>{studioHoursSummary(row.studio.dayHours)}</p>
                <p>
                  {row.teacherCount} profesor
                  {row.teacherCount === 1 ? "" : "es"} · {row.clientCount} alumno
                  {row.clientCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <StudioDayAgenda
                  studioId={row.studio.id}
                  openWeekdays={row.studio.dayHours.map((day) => day.weekday)}
                />
                <Link
                  href={`/estudio/${row.studio.id}/profesores`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
                >
                  <GraduationCap className="size-4" data-icon="inline-start" />
                  Profesores
                </Link>
                <Link
                  href={`/estudio/${row.studio.id}/alumnos`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
                >
                  <Users className="size-4" data-icon="inline-start" />
                  Alumnos
                </Link>
                <Link
                  href={`/estudio/${row.studio.id}/ausencias`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
                >
                  <CalendarOff className="size-4" data-icon="inline-start" />
                  Ausencias
                </Link>
                <Link
                  href={`/estudio/${row.studio.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
                >
                  <Pencil className="size-4" data-icon="inline-start" />
                  Detalles
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
