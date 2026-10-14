"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { studioKindsLabel, WEEKDAYS } from "@/lib/labels";
import type { StudioKind } from "@/lib/types";
import { occupancyForActivities } from "@/lib/hours";
import {
  loadClientBooking,
  saveClientReservations,
  type StudioReservationView,
  type StudioSlotTeacher,
  type StudioSlotView,
} from "@/lib/studio";
import type { Studio } from "@/lib/types";
import { cn } from "@/lib/utils";

function teachersInSlot(cell: StudioSlotView | undefined) {
  if (!cell) return [];
  const seen = new Set<string>();
  const teachers: StudioSlotTeacher[] = [];
  for (const teacher of cell.teachers) {
    if (seen.has(teacher.userId)) continue;
    seen.add(teacher.userId);
    teachers.push(teacher);
  }
  return teachers.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function SlotBody({
  full,
  teachers,
}: {
  full: boolean;
  teachers: StudioSlotTeacher[];
}) {
  if (full) {
    return (
      <p className="text-[11px] font-semibold tracking-wide sm:text-xs">
        SIN CUPO
      </p>
    );
  }
  if (teachers.length === 0) {
    return <p className="text-[11px] opacity-40 sm:text-sm">—</p>;
  }
  return (
    <ul className="space-y-1">
      {teachers.map((item) => (
        <li
          key={item.userId}
          className="truncate rounded-md bg-primary/18 px-1.5 py-0.5 text-[11px] font-medium leading-snug ring-1 ring-primary/30 sm:text-xs"
        >
          {item.name}
        </li>
      ))}
    </ul>
  );
}

export function StudioBooking() {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [teacher, setTeacher] = useState<{ userId: string; name: string } | null>(
    null
  );
  const [allowed, setAllowed] = useState(1);
  const [activities, setActivities] = useState<StudioKind[]>(["gym"]);
  const [editing, setEditing] = useState(false);
  const [occupancy, setOccupancy] = useState<StudioSlotView[]>([]);
  const [mine, setMine] = useState<StudioReservationView[]>([]);
  const [picks, setPicks] = useState<{ weekday: number; slotStart: string }[]>(
    []
  );
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadClientBooking()
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setMissing(true);
          return;
        }
        setStudio(row.studio);
        setTeacher(row.teacher);
        setAllowed(row.sessionsPerWeek);
        setActivities(row.activities);
        setOccupancy(row.occupancy);
        setMine(row.mine);
        setPicks(
          row.mine.map((item) => ({
            weekday: item.weekday,
            slotStart: item.slotStart,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(
    () =>
      WEEKDAYS.filter((day) =>
        occupancy.some((item) => item.weekday === day.id)
      ),
    [occupancy]
  );
  const slots = useMemo(
    () => [...new Set(occupancy.map((item) => item.slotStart))],
    [occupancy]
  );

  function selectedOn(weekday: number) {
    return picks.find((item) => item.weekday === weekday) ?? null;
  }

  function toggle(weekday: number, slotStart: string) {
    const current = selectedOn(weekday);
    if (current?.slotStart === slotStart) {
      setPicks((list) => list.filter((item) => item.weekday !== weekday));
      return;
    }
    const cell = occupancy.find(
      (item) => item.weekday === weekday && item.slotStart === slotStart
    );
    const selfInDb = mine.some(
      (item) => item.weekday === weekday && item.slotStart === slotStart
    );
    const counts = cell
      ? occupancyForActivities(cell, activities, {
          inDb: selfInDb,
          selected: true,
        })
      : { full: true, display: "" };
    if (!cell || (counts.full && !selfInDb)) {
      toast.error(`Sin cupo el ${WEEKDAYS.find((d) => d.id === weekday)?.full ?? "día"} a las ${slotStart}.`);
      return;
    }
    const withoutDay = picks.filter((item) => item.weekday !== weekday);
    if (!current && withoutDay.length >= allowed) {
      toast.error(`Te tocan ${allowed} veces por semana.`);
      return;
    }
    setPicks([...withoutDay, { weekday, slotStart }]);
  }

  async function save() {
    setBusy(true);
    try {
      const next = await saveClientReservations(picks);
      if (!next) throw new Error("No se pudo guardar.");
      setStudio(next.studio);
      setTeacher(next.teacher);
      setAllowed(next.sessionsPerWeek);
      setActivities(next.activities);
      setOccupancy(next.occupancy);
      setMine(next.mine);
      setPicks(
        next.mine.map((item) => ({
          weekday: item.weekday,
          slotStart: item.slotStart,
        }))
      );
      setEditing(false);
      toast.success("Agenda guardada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudieron guardar los días."
      );
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-10">
          <h1 className="font-heading text-4xl tracking-tight italic">
            Sin gimnasio.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Si te dieron un código ALU-, úsalo para entrar.
          </p>
          <Link
            href="/unirse"
            className={cn(buttonVariants(), "mt-6 h-11 px-5")}
          >
            Cargar código
          </Link>
        </main>
      </div>
    );
  }

  if (!studio) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando turnos…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          {studio.name}
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          Tu agenda.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {`${studioKindsLabel(activities)} · ${
            allowed === 1 ? "1 vez" : `${allowed} veces`
          } por semana${teacher ? ` con ${teacher.name}` : ""}.`}
        </p>

        {occupancy.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Esta sucursal todavía no tiene días y horarios.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <div
              className="grid min-w-[36rem] gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `2.8rem repeat(${days.length}, minmax(0, 1fr))`,
              }}
            >
              <p className="px-0.5 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                Hora
              </p>
              {days.map((day) => (
                <p
                  key={day.id}
                  className="px-0.5 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs"
                >
                  {day.short}
                </p>
              ))}
              {slots.map((slot) => (
                <div key={slot} className="contents">
                  <p className="flex items-start px-0.5 pt-2 text-[11px] font-medium sm:text-sm">
                    {slot}
                  </p>
                  {days.map((day) => {
                    const cell = occupancy.find(
                      (item) =>
                        item.weekday === day.id && item.slotStart === slot
                    );
                    const mineHere = selectedOn(day.id)?.slotStart === slot;
                    const selfInDb = mine.some(
                      (item) =>
                        item.weekday === day.id && item.slotStart === slot
                    );
                    const counts = cell
                      ? occupancyForActivities(cell, activities, {
                          inDb: selfInDb,
                          selected: mineHere,
                        })
                      : { full: true, display: "—" };
                    const full = Boolean(cell && counts.full && !mineHere);
                    const blocked = !cell || full;
                    const teachers = teachersInSlot(cell);
                    const chrome = cn(
                      "min-h-[3.4rem] rounded-lg px-1 py-1.5 text-left ring-1 sm:rounded-xl sm:px-1.5 sm:py-2",
                      mineHere
                        ? "bg-chart-2/18 ring-chart-2/40"
                        : full
                          ? "bg-muted/60 text-muted-foreground ring-transparent"
                          : "bg-card ring-foreground/10"
                    );
                    const body = (
                      <SlotBody full={full} teachers={teachers} />
                    );
                    if (editing) {
                      return (
                        <button
                          key={day.id}
                          type="button"
                          disabled={blocked && !mineHere}
                          onClick={() => toggle(day.id, slot)}
                          className={cn(
                            chrome,
                            !blocked && !mineHere && "hover:ring-primary/40"
                          )}
                        >
                          {body}
                        </button>
                      );
                    }
                    return (
                      <div key={day.id} className={chrome}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {occupancy.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {editing ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Elegidos {picks.length} de {allowed}.
                </p>
                <Button
                  className="h-11 px-5"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? "Guardando…" : "Guardar agenda"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 px-4"
                  disabled={busy}
                  onClick={() => {
                    setPicks(
                      mine.map((item) => ({
                        weekday: item.weekday,
                        slotStart: item.slotStart,
                      }))
                    );
                    setEditing(false);
                  }}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 px-5"
                onClick={() => setEditing(true)}
              >
                Cambiar días
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
