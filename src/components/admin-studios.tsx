"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useAppStore } from "@/components/app-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatBillingYmd, formatClientFee } from "@/lib/client-account";
import { listContractedStudios } from "@/lib/admin";
import type { ContractedStudioSummary } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cargar.";
}

function statusLabel(row: ContractedStudioSummary) {
  if (!row.serviceActive) return { text: "Desactivado", tone: "danger" as const };
  if (row.paymentDue) return { text: "Adeuda", tone: "danger" as const };
  if (row.expired) return { text: "Vencido", tone: "warn" as const };
  return { text: "Al día", tone: "ok" as const };
}

const statusClass = {
  ok: "text-emerald-800 dark:text-emerald-300",
  warn: "text-amber-800 dark:text-amber-300",
  danger: "text-destructive",
} as const;

export function AdminStudiosView() {
  const { logoutDemo } = useAppStore();
  const [rows, setRows] = useState<ContractedStudioSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listContractedStudios()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(errorMessage(error));
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null && !loadError) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando estudios…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Administración
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
              Estudios contratados.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Gimnasios que usan Enforma. Tocá uno para ver el contrato y el
              contacto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/estudios/nuevo"
              className={cn(buttonVariants(), "h-10 px-4")}
            >
              <Plus className="size-4" data-icon="inline-start" />
              Nuevo estudio
            </Link>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              onClick={() => {
                void logoutDemo().then(() => {
                  window.location.href = "/admin";
                });
              }}
            >
              <LogOut className="size-4" data-icon="inline-start" />
              Salir
            </Button>
          </div>
        </div>

        {loadError ? (
          <p className="mt-6 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
        ) : null}

        <section className="mt-8">
          {rows && rows.length > 0 ? (
            <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
              {rows.map((row) => {
                const status = statusLabel(row);
                const fee = formatClientFee(row.serviceFeeAmount);
                return (
                  <li key={row.userId}>
                    <Link
                      href={`/admin/estudios/${encodeURIComponent(row.userId)}`}
                      className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="font-medium">{row.gymName}</p>
                          <p
                            className={cn(
                              "text-xs font-medium tracking-wide uppercase",
                              statusClass[status.tone]
                            )}
                          >
                            {status.text}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.contactName
                            ? `Contacto ${row.contactName}`
                            : `Usuario ${row.username || "—"}`}
                          {` · ${row.branchCount}/${row.maxBranches} sucursales`}
                          {fee ? ` · ${fee}` : ""}
                          {row.serviceStartsOn
                            ? ` · desde ${formatBillingYmd(row.serviceStartsOn)}`
                            : ""}
                          {row.serviceEndsOn
                            ? ` · vence ${formatBillingYmd(row.serviceEndsOn)}`
                            : ""}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-foreground/8 bg-card px-4 py-6">
              <p className="text-sm text-muted-foreground">
                Todavía no hay estudios contratados.
              </p>
              <Link
                href="/admin/estudios/nuevo"
                className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-10 px-4")}
              >
                <Plus className="size-4" data-icon="inline-start" />
                Añadir el primero
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
