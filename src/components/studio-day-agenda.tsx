"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatHour } from "@/lib/hours";
import { weekdayName } from "@/lib/labels";
import {
  loadDayAgenda,
  type DayAgenda,
  type DayAgendaSlot,
  type NextHourPerson,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDdMmYyyy(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isOpenDay(date: Date, openWeekdays: number[]) {
  return openWeekdays.includes(date.getDay());
}

function nearestOpenDay(from: Date, openWeekdays: number[]) {
  if (!openWeekdays.length) return startOfDay(from);
  const start = startOfDay(from);
  for (let i = 0; i < 7; i += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    if (isOpenDay(next, openWeekdays)) return next;
  }
  return start;
}

function shiftOpenDay(from: Date, openWeekdays: number[], delta: 1 | -1) {
  if (!openWeekdays.length) return startOfDay(from);
  let cursor = startOfDay(from);
  for (let i = 0; i < 7; i += 1) {
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + delta);
    if (isOpenDay(cursor, openWeekdays)) return cursor;
  }
  return startOfDay(from);
}

function studentsInSlot(slot: DayAgendaSlot): NextHourPerson[] {
  const byId = new Map<string, NextHourPerson>();
  for (const teacher of slot.teachers) {
    for (const student of teacher.students) {
      byId.set(student.userId, student);
    }
  }
  for (const student of slot.unassignedStudents) {
    byId.set(student.userId, student);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

const agendaGrid =
  "grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:gap-2";

function NameLane({
  label,
  people,
  tone,
}: {
  label: string;
  people: NextHourPerson[];
  tone: "student" | "teacher";
}) {
  const toneClass =
    tone === "student"
      ? "bg-chart-2/18 text-foreground ring-chart-2/35"
      : "bg-primary/18 text-foreground ring-primary/30";
  return (
    <section
      aria-label={label}
      className={cn("min-h-[3.25rem] rounded-xl px-2.5 py-2 ring-1", toneClass)}
    >
      {people.length === 0 ? (
        <p className="text-sm opacity-50">—</p>
      ) : (
        <ul className="space-y-0.5">
          {people.map((person) => (
            <li key={person.userId} className="text-sm font-medium leading-snug">
              {person.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StudioDayAgenda({
  studioId,
  openWeekdays,
}: {
  studioId: string;
  openWeekdays: number[];
}) {
  const openDays = useMemo(
    () => [...new Set(openWeekdays)].sort((a, b) => a - b),
    [openWeekdays]
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState(() => nearestOpenDay(new Date(), openDays));
  const [data, setData] = useState<DayAgenda | null>(null);
  const [error, setError] = useState("");
  const weekday = date.getDay();
  const today = startOfDay(new Date());
  const nowSlot = formatHour(new Date().getHours() * 60);
  const ready = data?.weekday === weekday;
  const isToday = sameDay(date, today);
  const hoursCaption = !ready
    ? isToday
      ? "Hoy"
      : "\u00a0"
    : data.openFrom && data.openTo
      ? isToday
        ? `Hoy · ${data.openFrom}–${data.openTo}`
        : `${data.openFrom}–${data.openTo}`
      : isToday
        ? "Hoy"
        : "\u00a0";
  const canNavigate = openDays.length > 1;

  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    setError("");
    void loadDayAgenda(studioId, weekday)
      .then((next) => {
        if (cancelled) return;
        setData(next);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar la agenda."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, studioId, weekday, date]);

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(next) => {
        setDialogOpen(next);
        if (next) {
          setDate(nearestOpenDay(new Date(), openDays));
          setData(null);
          setError("");
        }
      }}
    >
      <DialogTrigger
        nativeButton
        className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
      >
        <CalendarDays className="size-4" data-icon="inline-start" />
        Agenda
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl italic">
            Agenda
          </DialogTitle>
          <DialogDescription>
            Profesores y alumnos de cada hora.
          </DialogDescription>
        </DialogHeader>
        {openDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta sucursal todavía no tiene días abiertos.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Día anterior"
                disabled={!canNavigate}
                onClick={() =>
                  setDate((current) => shiftOpenDay(current, openDays, -1))
                }
              >
                <ChevronLeft />
              </Button>
              <div className="text-center">
                <p className="font-heading text-xl italic">
                  {weekdayName(weekday)}
                </p>
                <p className="text-sm tabular-nums text-foreground">
                  {formatDdMmYyyy(date)}
                </p>
                <p className="text-xs text-muted-foreground">{hoursCaption}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Día siguiente"
                disabled={!canNavigate}
                onClick={() =>
                  setDate((current) => shiftOpenDay(current, openDays, 1))
                }
              >
                <ChevronRight />
              </Button>
            </div>
            {error ? (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : !data || data.weekday !== weekday ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : data.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay horarios cargados para este día.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-foreground/8">
                <div
                  className={cn(
                    agendaGrid,
                    "sticky top-0 z-10 border-b border-foreground/8 bg-popover px-2 py-2 sm:px-3"
                  )}
                >
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Hora
                  </p>
                  <p className="px-2.5 text-[11px] font-medium tracking-wide text-chart-2 uppercase">
                    Alumnos
                  </p>
                  <p className="px-2.5 text-[11px] font-medium tracking-wide text-primary uppercase">
                    Profesores
                  </p>
                </div>
                <ol>
                  {data.slots.map((slot, index) => {
                    const students = studentsInSlot(slot);
                    const current = isToday && slot.slotStart === nowSlot;
                    return (
                      <li
                        key={slot.slotStart}
                        className={cn(
                          agendaGrid,
                          "px-2 py-1.5 sm:px-3",
                          index > 0 && "border-t border-foreground/8",
                          current && "bg-foreground/[0.03]"
                        )}
                      >
                        <p
                          className={cn(
                            "pt-2 text-sm font-medium tabular-nums",
                            current ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {slot.slotStart}
                        </p>
                        <NameLane
                          label="Alumnos"
                          people={students}
                          tone="student"
                        />
                        <NameLane
                          label="Profesores"
                          people={slot.teachers}
                          tone="teacher"
                        />
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
