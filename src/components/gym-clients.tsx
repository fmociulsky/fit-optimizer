"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { BackLink } from "@/components/back-link";
import { SearchCreateBar } from "@/components/search-create-bar";
import { SiteHeader } from "@/components/site-header";
import { ClientTeacherAssign } from "@/components/studio-assign";
import {
  StudioClientEditDialog,
  StudioClientForm,
  type StudioClientDraft,
} from "@/components/studio-client-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { studioKindsLabel, WEEKDAYS } from "@/lib/labels";
import { matchesSearch } from "@/lib/search";
import {
  deleteStudioClient,
  listGymClients,
  listOwnedBranches,
  loadStudioDashboard,
  type GymClientSummary,
  type StudioDashboard,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cargar.";
}

function weekdayLabel(id: number) {
  return WEEKDAYS.find((item) => item.id === id)?.full ?? "Día";
}

export function GymClientsView() {
  const [rows, setRows] = useState<GymClientSummary[] | null>(null);
  const [studios, setStudios] = useState<{ id: string; name: string }[]>([]);
  const [studioId, setStudioId] = useState("");
  const [dash, setDash] = useState<StudioDashboard | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StudioClientDraft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  async function refreshClients() {
    setRows(await listGymClients());
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listGymClients(), listOwnedBranches()])
      .then(([clients, branches]) => {
        if (cancelled) return;
        setRows(clients);
        const nextStudios = branches.map((item) => ({
          id: item.studio.id,
          name: item.studio.name,
        }));
        setStudios(nextStudios);
        setStudioId((current) => current || nextStudios[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!studioId) {
      setDash(null);
      return;
    }
    let cancelled = false;
    setDash(null);
    setOpenId(null);
    void loadStudioDashboard(studioId)
      .then((next) => {
        if (!cancelled) setDash(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [studioId]);

  const branchClients = useMemo(
    () => (rows ?? []).filter((item) => item.studioId === studioId),
    [rows, studioId]
  );
  const visible = useMemo(
    () =>
      branchClients.filter((item) =>
        matchesSearch(query, item.displayName, item.email, item.username)
      ),
    [branchClients, query]
  );
  const studioName = studios.find((item) => item.id === studioId)?.name;

  function draftFromClient(client: GymClientSummary): StudioClientDraft {
    return {
      userId: client.userId,
      displayName: client.displayName,
      phone: client.phone,
      email: client.email,
      birthDate: client.birthDate,
      activities: client.activities,
      sessionsPerWeek: client.sessionsPerWeek,
      assignedTeacherUserId: client.assignedTeacherUserId,
      picks: client.reservations.map((item) => ({
        weekday: item.weekday,
        slotStart: item.slotStart,
      })),
    };
  }

  async function removeClient(client: GymClientSummary) {
    const ok = window.confirm(
      `¿Eliminar a ${client.displayName} de esta sucursal? Se borran sus días reservados.`
    );
    if (!ok) return;
    try {
      const next = await deleteStudioClient({
        studioId: client.studioId,
        clientUserId: client.userId,
      });
      setDash(next);
      if (editing?.userId === client.userId) setEditing(null);
      await refreshClients();
      toast.success("Alumno eliminado.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

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
        Cargando alumnos…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
        <div>
          <BackLink href="/estudio" />
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Gimnasio
          </p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
            Alumnos.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Los de esta sucursal. Buscá por nombre o email, o abrí cada uno
            para asignarle un profesor.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5 sm:max-w-xs">
            <label htmlFor="alumnos-sucursal" className="sr-only">
              Sucursal
            </label>
            <select
              id="alumnos-sucursal"
              className={fieldClass}
              value={studioId}
              onChange={(event) => {
                setCreating(false);
                setEditing(null);
                setStudioId(event.target.value);
              }}
            >
              {studios.length === 0 && (
                <option value="">Sin sucursales</option>
              )}
              {studios.map((studio) => (
                <option key={studio.id} value={studio.id}>
                  {studio.name}
                </option>
              ))}
            </select>
          </div>
          <SearchCreateBar
            query={query}
            onQueryChange={setQuery}
            placeholder="Buscar por nombre o email"
            createLabel="Nuevo alumno"
            creating={creating}
            onToggleCreate={() => setCreating((open) => !open)}
          />
        </div>
        {creating && (
          <StudioClientForm
            studioId={studioId}
            dash={dash}
            onSaved={async (next) => {
              setDash(next);
              setCreating(false);
              await refreshClients();
            }}
          />
        )}
        <StudioClientEditDialog
          draft={editing}
          studioId={studioId}
          dash={dash}
          onClose={() => setEditing(null)}
          onSaved={async (next) => {
            setDash(next);
            setEditing(null);
            await refreshClients();
          }}
        />
        <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
          {visible.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              {branchClients.length === 0
                ? `Todavía no hay alumnos${studioName ? ` en ${studioName}` : ""}.`
                : "Ningún alumno coincide con esa búsqueda."}
            </li>
          )}
          {visible.map((client) => {
            const rowId = `${client.studioId}:${client.userId}`;
            return (
            <li key={rowId}>
              <details
                className="group"
                open={openId === rowId}
                onToggle={(event) => {
                  if (event.currentTarget.open) setOpenId(rowId);
                  else if (openId === rowId) setOpenId(null);
                }}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <p className="min-w-0 flex-1 truncate font-medium">
                    {client.displayName}
                  </p>
                  <p className="hidden min-w-0 max-w-[14rem] truncate text-sm text-muted-foreground sm:block">
                    {client.email || client.phone || "—"}
                  </p>
                  <p className="hidden min-w-0 max-w-[10rem] truncate text-sm text-muted-foreground lg:block">
                    {client.teacherName || "Sin profesor"}
                  </p>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-foreground/8 px-4 pt-3 pb-4">
                  {client.email ? (
                    <p className="text-sm text-muted-foreground">
                      Email: {client.email}
                    </p>
                  ) : null}
                  {client.username ? (
                    <p className="text-sm text-muted-foreground">
                      Usuario: {client.username}
                    </p>
                  ) : null}
                  {client.phone ? (
                    <p className="text-sm text-muted-foreground">
                      Teléfono: {client.phone}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Actividad: {studioKindsLabel(client.activities)}
                  </p>
                  {dash ? (
                    <ClientTeacherAssign
                      studioId={client.studioId}
                      person={{
                        userId: client.userId,
                        displayName: client.displayName,
                        email: client.email,
                        assignedTeacherUserId: client.assignedTeacherUserId,
                        assignedTeacherName: client.teacherName,
                      }}
                      teachers={dash.people
                        .filter(
                          (item) =>
                            item.role === "teacher" &&
                            item.userId &&
                            (item.active ||
                              item.userId === client.assignedTeacherUserId)
                        )
                        .map((item) => ({
                          userId: item.userId!,
                          displayName: item.displayName,
                        }))}
                      onSaved={async (next) => {
                        setDash(next);
                        await refreshClients();
                      }}
                    />
                  ) : null}
                  <div>
                    <p className="text-sm font-medium">
                      {client.sessionsPerWeek
                        ? client.sessionsPerWeek === 1
                          ? "1 día por semana"
                          : `${client.sessionsPerWeek} días por semana`
                        : "Días que asiste"}
                    </p>
                    {client.reservations.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {[...client.reservations]
                          .sort(
                            (a, b) =>
                              a.weekday - b.weekday ||
                              a.slotStart.localeCompare(b.slotStart)
                          )
                          .map((item) => (
                            <li
                              key={`${item.weekday}-${item.slotStart}`}
                              className="text-sm text-muted-foreground"
                            >
                              {weekdayLabel(item.weekday)} {item.slotStart}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Todavía no tiene días cargados.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {client.hasPlan ? (
                      <Link
                        href={`/estudio/alumnos/${encodeURIComponent(client.userId)}?desde=${encodeURIComponent("/estudio/alumnos")}`}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-10 px-4"
                        )}
                      >
                        Ver plan
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-4"
                        disabled
                      >
                        Ver plan
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 px-4"
                      onClick={() => {
                        setCreating(false);
                        setEditing(draftFromClient(client));
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-10 px-4"
                      onClick={() => void removeClient(client)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </details>
            </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
