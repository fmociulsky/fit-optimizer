"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BackLink } from "@/components/back-link";
import { SiteHeader } from "@/components/site-header";
import { StudioBranchNav } from "@/components/studio-branch-nav";
import { GymMachinePicker } from "@/components/gym-machine-picker";
import { PilatesItemPicker } from "@/components/pilates-item-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clockHours, defaultDayHours } from "@/lib/hours";
import { TYPICAL_GYM_MACHINE_IDS } from "@/lib/gym-machines";
import { WEEKDAYS } from "@/lib/labels";
import { TYPICAL_PILATES_IDS } from "@/lib/pilates";
import {
  createStudioBranch,
  deleteStudioBranch,
  loadStudioDashboard,
  saveStudioBranch,
} from "@/lib/studio";
import { cn } from "@/lib/utils";
import type { Studio, StudioDayHours, StudioKind } from "@/lib/types";
import { studioHasKind } from "@/lib/types";

const HOURS = clockHours();
const fieldClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-1.5 text-sm md:px-2.5";

function weekdayLabel(id: number) {
  return WEEKDAYS.find((item) => item.id === id)?.full ?? "Día";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export function StudioBranchForm({
  studioId,
  embedded = false,
}: {
  studioId?: string;
  embedded?: boolean;
}) {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [name, setName] = useState("");
  const [kinds, setKinds] = useState<StudioKind[]>(["gym"]);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [dayHours, setDayHours] = useState<StudioDayHours[]>(defaultDayHours());
  const [gymMachines, setGymMachines] = useState<string[]>([
    ...TYPICAL_GYM_MACHINE_IDS,
  ]);
  const [pilatesItems, setPilatesItems] = useState<string[]>([
    ...TYPICAL_PILATES_IDS,
  ]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!studioId) return;
    let cancelled = false;
    void loadStudioDashboard(studioId)
      .then((next) => {
        if (cancelled) return;
        setStudio(next.studio);
        setName(next.studio.name);
        setKinds(next.studio.kinds);
        setAddress(next.studio.address);
        setPhone(next.studio.phone);
        setDayHours(next.studio.dayHours);
        setGymMachines(next.studio.gymMachines);
        setPilatesItems(next.studio.pilatesItems);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [studioId]);

  function toggleKind(id: StudioKind) {
    setKinds((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        return next.length ? next : current;
      }
      return [...current, id];
    });
  }

  function toggleDay(id: number) {
    setDayHours((current) => {
      if (current.some((item) => item.weekday === id)) {
        return current.filter((item) => item.weekday !== id);
      }
      const template = current[0];
      const next: StudioDayHours = {
        weekday: id,
        openFrom: template?.openFrom ?? "08:00",
        openTo: template?.openTo ?? "21:00",
        gymCapacity: template?.gymCapacity ?? 8,
        pilatesCapacity: template?.pilatesCapacity ?? 8,
      };
      return [...current, next].sort(
        (a, b) =>
          WEEKDAYS.findIndex((day) => day.id === a.weekday) -
          WEEKDAYS.findIndex((day) => day.id === b.weekday)
      );
    });
  }

  function patchDay(weekday: number, patch: Partial<StudioDayHours>) {
    setDayHours((current) =>
      current.map((item) =>
        item.weekday === weekday ? { ...item, ...patch } : item
      )
    );
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const payload = {
        name,
        kinds,
        address,
        phone,
        dayHours,
        gymMachines,
        pilatesItems,
      };
      if (studioId) {
        const next = await saveStudioBranch(studioId, payload);
        setStudio(next.studio);
        toast.success("Sucursal actualizada.");
      } else {
        await createStudioBranch(payload);
        toast.success("Sucursal dada de alta.");
        window.location.assign("/estudio");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!studioId || busy) return;
    const ok = window.confirm(
      "¿Eliminar esta sucursal? Se desvinculan los profesores y los alumnos de acá. No se borra su cuenta."
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteStudioBranch(studioId);
      toast.success("Sucursal eliminada.");
      window.location.assign("/estudio");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (studioId && !studio) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando sucursal…
      </div>
    );
  }

  const form = (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="branch-name">Nombre</Label>
          <Input
            id="branch-name"
            className="h-11 text-base"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Casa Norte"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Tipo</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["gym", "Gimnasio"],
                ["pilates", "Pilates"],
              ] as const
            ).map(([id, label]) => {
              const on = kinds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleKind(id)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium",
                    on
                      ? "border-primary bg-primary/8 ring-1 ring-primary"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Puedes marcar los dos.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch-address">Dirección</Label>
          <Input
            id="branch-address"
            className="h-11 text-base"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Calle y número"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch-phone">Teléfono</Label>
          <Input
            id="branch-phone"
            className="h-11 text-base"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="11 5555-0000"
            inputMode="tel"
          />
        </div>
      </div>

      <section>
        <h2 className="font-heading text-2xl italic">Días y horarios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada día abierto tiene su franja y el cupo de las actividades de esta
          sucursal.
        </p>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day) => {
            const on = dayHours.some((item) => item.weekday === day.id);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleDay(day.id)}
                className={cn(
                  "rounded-2xl py-3 text-sm font-medium",
                  on
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {day.short}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-3">
          {dayHours.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Marca al menos un día.
            </p>
          )}
          {dayHours.map((day) => (
            <div
              key={day.weekday}
              className="rounded-2xl border border-foreground/8 bg-card p-3"
            >
              <p className="mb-2 font-medium">{weekdayLabel(day.weekday)}</p>
              <div
                className={cn(
                  "grid items-end gap-2",
                  studioHasKind(kinds, "gym") && studioHasKind(kinds, "pilates")
                    ? "grid-cols-4"
                    : "grid-cols-3"
                )}
              >
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`open-from-${day.weekday}`}>Abre</Label>
                  <select
                    id={`open-from-${day.weekday}`}
                    className={fieldClass}
                    value={day.openFrom}
                    onChange={(event) =>
                      patchDay(day.weekday, { openFrom: event.target.value })
                    }
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`open-to-${day.weekday}`}>Cierra</Label>
                  <select
                    id={`open-to-${day.weekday}`}
                    className={fieldClass}
                    value={day.openTo}
                    onChange={(event) =>
                      patchDay(day.weekday, { openTo: event.target.value })
                    }
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>
                {studioHasKind(kinds, "gym") && (
                  <div className="min-w-0 space-y-1">
                    <Label
                      htmlFor={`gym-cupo-${day.weekday}`}
                      className="leading-tight"
                    >
                      Cupo gimnasio
                    </Label>
                    <Input
                      id={`gym-cupo-${day.weekday}`}
                      className="h-11 min-w-0 px-1.5 text-sm md:px-2.5"
                      inputMode="numeric"
                      value={String(day.gymCapacity ?? 8)}
                      onChange={(event) =>
                        patchDay(day.weekday, {
                          gymCapacity: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )}
                {studioHasKind(kinds, "pilates") && (
                  <div className="min-w-0 space-y-1">
                    <Label
                      htmlFor={`pilates-cupo-${day.weekday}`}
                      className="leading-tight"
                    >
                      Cupo pilates
                    </Label>
                    <Input
                      id={`pilates-cupo-${day.weekday}`}
                      className="h-11 min-w-0 px-1.5 text-sm md:px-2.5"
                      inputMode="numeric"
                      value={String(day.pilatesCapacity ?? 8)}
                      onChange={(event) =>
                        patchDay(day.weekday, {
                          pilatesCapacity: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {studioHasKind(kinds, "gym") && (
        <section>
          <h2 className="font-heading text-2xl italic">Máquinas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marca las que hay de verdad en esta sucursal.
          </p>
          <div className="mt-4">
            <GymMachinePicker selected={gymMachines} onChange={setGymMachines} />
          </div>
        </section>
      )}

      {studioHasKind(kinds, "pilates") && (
        <section>
          <h2 className="font-heading text-2xl italic">Material de pilates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reformer, cadillac, colchoneta y lo que haya en esta sucursal.
          </p>
          <div className="mt-4">
            <PilatesItemPicker selected={pilatesItems} onChange={setPilatesItems} />
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button className="h-11 px-5" disabled={busy} onClick={() => void save()}>
          {busy
            ? "Guardando…"
            : studioId
              ? "Guardar sucursal"
              : "Dar de alta"}
        </Button>
        {!studioId && (
          <Link
            href="/estudio"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}
          >
            Cancelar
          </Link>
        )}
        {studioId && (
          <Button
            type="button"
            variant="destructive"
            className="h-11 px-5"
            disabled={busy}
            onClick={() => void remove()}
          >
            Eliminar sucursal
          </Button>
        )}
      </div>
    </div>
  );

  if (embedded) return form;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {studioId && studio ? (
          <StudioBranchNav
            studioId={studioId}
            name={studio.name}
            active="detalles"
          />
        ) : (
          <>
            <BackLink href="/estudio" />
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Gimnasio
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
              Nueva sucursal.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Nombre, tipo, dirección, teléfono y los días que abre.
            </p>
          </>
        )}
        <div className="mt-8">{form}</div>
      </main>
    </div>
  );
}
