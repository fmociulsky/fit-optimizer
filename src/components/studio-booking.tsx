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

function teachersInSlot(
  cell: StudioSlotView | undefined,
  assignedTeacherId?: string | null
) {
  if (!cell) return [];
  const seen = new Set<string>();
  const teachers: StudioSlotTeacher[] = [];
  for (const teacher of cell.teachers) {
    if (seen.has(teacher.userId)) continue;
    seen.add(teacher.userId);
    teachers.push(teacher);
  }
  return teachers.sort((a, b) => {
    if (assignedTeacherId) {
      if (a.userId === assignedTeacherId) return -1;
      if (b.userId === assignedTeacherId) return 1;
    }
    return a.name.localeCompare(b.name, "es");
  });
}

function SlotBody({
  full,
  teachers,
  assignedTeacherId,
  selected,
}: {
  full: boolean;
  teachers: StudioSlotTeacher[];
  assignedTeacherId?: string | null;
  selected?: boolean;
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
    <div className="space-y-1">
      {selected ? (
        <p className="text-[11px] font-semibold tracking-wide text-chart-2 sm:text-xs">
          Tu horario
        </p>
      ) : null}
      <ul className="space-y-1">
        {teachers.map((item) => {
          const mine = Boolean(
            assignedTeacherId && item.userId === assignedTeacherId
          );
          return (
            <li
              key={item.userId}
              className={cn(
                "truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-snug ring-1 sm:text-xs",
                mine
                  ? "bg-chart-2/30 text-foreground ring-chart-2/55"
                  : "bg-muted/80 text-muted-foreground ring-foreground/10"
              )}
            >
              {item.name}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function weekdayName(id: number) {
  return WEEKDAYS.find((day) => day.id === id)?.full ?? "Día";
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
  const [mobileDay, setMobileDay] = useState<number | null>(null);

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
        const firstDay = WEEKDAYS.find((day) =>
          row.occupancy.some((item) => item.weekday === day.id)
        )?.id;
        setMobileDay(firstDay ?? null);
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

  const mobileSlots = useMemo(() => {
    if (mobileDay == null) return [];
    return slots
      .map((slotStart) => {
        const cell = occupancy.find(
          (item) => item.weekday === mobileDay && item.slotStart === slotStart
        );
        return { slotStart, cell };
      })
      .filter((item) => item.cell);
  }, [mobileDay, occupancy, slots]);

  function selectedOn(weekday: number) {
    return picks.find((item) => item.weekday === weekday) ?? null;
  }

  function toggle(weekday: number, slotStart: string) {
    if (!teacher) {
      toast.error("Todavía no te asignaron un profesor.");
      return;
    }
    const current = selectedOn(weekday);
    if (current?.slotStart === slotStart) {
      setPicks((list) => list.filter((item) => item.weekday !== weekday));
      return;
    }
    const cell = occupancy.find(
      (item) => item.weekday === weekday && item.slotStart === slotStart
    );
    if (!cell?.teachers.length) {
      toast.error(
        `No hay profesor el ${weekdayName(weekday)} a las ${slotStart}.`
      );
      return;
    }
    const selfInDb = mine.some(
      (item) => item.weekday === weekday && item.slotStart === slotStart
    );
    const counts = occupancyForActivities(cell, activities, {
      inDb: selfInDb,
      selected: true,
    });
    if (counts.full && !selfInDb) {
      toast.error(`Sin cupo el ${weekdayName(weekday)} a las ${slotStart}.`);
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

  function cancelEdit() {
    setPicks(
      mine.map((item) => ({
        weekday: item.weekday,
        slotStart: item.slotStart,
      }))
    );
    setEditing(false);
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

  const actions = occupancy.length > 0 && (
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
            onClick={cancelEdit}
          >
            Cancelar
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 px-5"
          disabled={!teacher}
          onClick={() => setEditing(true)}
        >
          Cambiar días
        </Button>
      )}
    </div>
  );

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
        {!teacher ? (
          <p className="mt-4 rounded-2xl border border-foreground/8 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Todavía no te asignaron un profesor. Cuando el gimnasio te asigne
            uno, vas a poder elegir día y horario.
          </p>
        ) : null}

        {occupancy.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Esta sucursal todavía no tiene días y horarios.
          </p>
        ) : (
          <>
            {/* Mobile: resumen o día + horas */}
            <div className="mt-6 space-y-4 sm:hidden">
              {!editing ? (
                <ul className="overflow-hidden rounded-2xl border border-foreground/8 bg-card">
                  {picks.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-muted-foreground">
                      Todavía no elegiste días.
                    </li>
                  ) : (
                    [...picks]
                      .sort(
                        (a, b) =>
                          a.weekday - b.weekday ||
                          a.slotStart.localeCompare(b.slotStart)
                      )
                      .map((item) => (
                        <li
                          key={`${item.weekday}-${item.slotStart}`}
                          className="flex items-center justify-between gap-3 border-t border-foreground/8 px-4 py-3 first:border-t-0"
                        >
                          <span className="font-medium">
                            {weekdayName(item.weekday)}
                          </span>
                          <span className="text-muted-foreground">
                            {item.slotStart}
                          </span>
                        </li>
                      ))
                  )}
                </ul>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium">Día</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {days.map((day) => {
                        const picked = selectedOn(day.id);
                        const active = mobileDay === day.id;
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => setMobileDay(day.id)}
                            className={cn(
                              "rounded-full px-3 py-2 text-sm font-medium",
                              active
                                ? "bg-primary text-primary-foreground"
                                : picked
                                  ? "bg-chart-2/25 text-foreground ring-1 ring-chart-2/40"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {day.short}
                            {picked ? ` · ${picked.slotStart}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {mobileDay != null ? (
                    <div>
                      <p className="text-sm font-medium">
                        Horario · {weekdayName(mobileDay)}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {mobileSlots.map(({ slotStart, cell }) => {
                          const mineHere =
                            selectedOn(mobileDay)?.slotStart === slotStart;
                          const selfInDb = mine.some(
                            (item) =>
                              item.weekday === mobileDay &&
                              item.slotStart === slotStart
                          );
                          const counts = occupancyForActivities(
                            cell!,
                            activities,
                            { inDb: selfInDb, selected: mineHere }
                          );
                          const full = counts.full && !mineHere;
                          const hasTeacher = Boolean(cell?.teachers.length);
                          const blocked =
                            full || !teacher || !hasTeacher;
                          const teachers = teachersInSlot(
                            cell,
                            teacher?.userId
                          );
                          return (
                            <li key={slotStart}>
                              <button
                                type="button"
                                disabled={blocked && !mineHere}
                                onClick={() => toggle(mobileDay, slotStart)}
                                className={cn(
                                  "flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left",
                                  mineHere
                                    ? "border-chart-2/40 bg-chart-2/15"
                                    : blocked
                                      ? "border-transparent bg-muted/50 text-muted-foreground"
                                      : "border-foreground/8 bg-card"
                                )}
                              >
                                <span className="font-medium">{slotStart}</span>
                                <span className="min-w-0 flex-1 text-right">
                                  <SlotBody
                                    full={full}
                                    teachers={teachers}
                                    assignedTeacherId={teacher?.userId}
                                    selected={mineHere}
                                  />
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
              {actions}
            </div>

            {/* Desktop: grilla */}
            <div className="mt-6 hidden overflow-x-auto sm:block">
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `2.8rem repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                <p className="px-0.5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Hora
                </p>
                {days.map((day) => (
                  <p
                    key={day.id}
                    className="px-0.5 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {day.short}
                  </p>
                ))}
                {slots.map((slot) => (
                  <div key={slot} className="contents">
                    <p className="flex items-start px-0.5 pt-2 text-sm font-medium">
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
                      const hasTeacher = Boolean(cell?.teachers.length);
                      const blocked =
                        !cell || full || !teacher || !hasTeacher;
                      const teachers = teachersInSlot(cell, teacher?.userId);
                      const chrome = cn(
                        "min-h-[3.4rem] rounded-xl px-1.5 py-2 text-left ring-1",
                        mineHere
                          ? "bg-chart-2/18 ring-chart-2/40"
                          : blocked
                            ? "bg-muted/60 text-muted-foreground ring-transparent"
                            : "bg-card ring-foreground/10"
                      );
                      const body = (
                        <SlotBody
                          full={full}
                          teachers={teachers}
                          assignedTeacherId={teacher?.userId}
                          selected={mineHere}
                        />
                      );
                      if (editing && teacher) {
                        return (
                          <button
                            key={day.id}
                            type="button"
                            disabled={blocked && !mineHere}
                            onClick={() => toggle(day.id, slot)}
                            className={cn(
                              chrome,
                              !blocked &&
                                !mineHere &&
                                "hover:ring-primary/40"
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
              {actions}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
