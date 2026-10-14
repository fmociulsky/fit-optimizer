"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useAppStore } from "@/components/app-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatHour, hourCovers, parseHour } from "@/lib/hours";
import { WEEKDAYS, weekdayShort } from "@/lib/labels";
import {
  localNoon,
  monthCells,
  monthLabel,
  sameLocalDay,
} from "@/lib/agenda";
import {
  listAssignedTeacherClients,
  loadTeacherStudioHours,
  type TeacherAssignedClient,
  type TeacherStudioHours,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

type DayBlock = {
  studioId: string;
  studioName: string;
  startHour: string;
  endHour: string;
};

function clock(value: string) {
  return value.replace(/^0(\d)/, "$1");
}

function dayHeading(date: Date) {
  const raw = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function slotLabel(slotStart: string) {
  const start = parseHour(slotStart);
  if (start == null) return clock(slotStart);
  return `${clock(formatHour(start))}–${clock(formatHour(start + 60))}`;
}

type DaySlot = { weekday: number; slotStart: string };

type DayStudent = {
  userId: string;
  displayName: string;
  slotStart: string;
  schedule: DaySlot[];
};

function weekdayIndex(weekday: number) {
  const index = WEEKDAYS.findIndex((day) => day.id === weekday);
  return index === -1 ? WEEKDAYS.length : index;
}

function scheduleLine(slots: DaySlot[]) {
  return [...slots]
    .sort(
      (a, b) =>
        weekdayIndex(a.weekday) - weekdayIndex(b.weekday) ||
        a.slotStart.localeCompare(b.slotStart)
    )
    .map((item) => `${weekdayShort(item.weekday)} ${slotLabel(item.slotStart)}`)
    .join(" · ");
}

function studentsForShift(
  clients: TeacherAssignedClient[],
  block: DayBlock,
  weekday: number
): DayStudent[] {
  const rows: DayStudent[] = [];
  for (const client of clients) {
    if (client.studioId !== block.studioId) continue;
    const today = client.reservations.find(
      (item) =>
        item.weekday === weekday &&
        hourCovers(block.startHour, block.endHour, item.slotStart)
    );
    if (!today) continue;
    rows.push({
      userId: client.userId,
      displayName: client.displayName,
      slotStart: today.slotStart,
      schedule: client.reservations,
    });
  }
  rows.sort(
    (a, b) =>
      a.slotStart.localeCompare(b.slotStart) ||
      a.displayName.localeCompare(b.displayName, "es")
  );
  return rows;
}

export function ProfessionalWeek() {
  const { ready, account } = useAppStore();
  const [studioHours, setStudioHours] = useState<TeacherStudioHours[] | null>(
    null
  );
  const [clients, setClients] = useState<TeacherAssignedClient[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [clientsError, setClientsError] = useState("");
  const [selected, setSelected] = useState(() => localNoon(new Date()));
  const [cursor, setCursor] = useState(() => localNoon(new Date()));
  const [openBlock, setOpenBlock] = useState<DayBlock | null>(null);

  useEffect(() => {
    if (!ready || account?.role !== "professional") return;
    let cancelled = false;
    void loadTeacherStudioHours()
      .then((rows) => {
        if (!cancelled) setStudioHours(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la agenda."
          );
          setStudioHours([]);
        }
      });
    void listAssignedTeacherClients()
      .then((rows) => {
        if (!cancelled) setClients(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setClientsError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los alumnos."
          );
          setClients([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [account?.role, ready]);

  const blocksByWeekday = useMemo(() => {
    const map = new Map<number, DayBlock[]>();
    for (const row of studioHours ?? []) {
      for (const shift of row.shifts) {
        const current = map.get(shift.weekday) ?? [];
        current.push({
          studioId: row.studio.id,
          studioName: row.studio.name,
          startHour: shift.startHour,
          endHour: shift.endHour,
        });
        map.set(shift.weekday, current);
      }
    }
    for (const blocks of map.values()) {
      blocks.sort(
        (a, b) =>
          a.startHour.localeCompare(b.startHour) ||
          a.studioName.localeCompare(b.studioName, "es")
      );
    }
    return map;
  }, [studioHours]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = localNoon(new Date());
  const cells = useMemo(() => {
    const dates = monthCells(year, month);
    const lastInMonth = dates.findLastIndex((date) => date.getMonth() === month);
    const weeks = Math.max(1, Math.ceil((lastInMonth + 1) / 7));
    return dates.slice(0, weeks * 7);
  }, [month, year]);
  const selectedBlocks = blocksByWeekday.get(selected.getDay()) ?? [];
  const hasShifts = blocksByWeekday.size > 0;

  function choose(date: Date) {
    const next = localNoon(date);
    setSelected(next);
    setCursor(next);
    setOpenBlock(null);
  }

  const openStudents = openBlock
    ? studentsForShift(clients ?? [], openBlock, selected.getDay())
    : [];

  if (!ready || studioHours === null) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando tu agenda…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Profesor
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          Tu agenda.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          En qué sucursal estás cada día, y en qué horario.
        </p>

        {loadError ? (
          <p className="mt-6 text-sm text-muted-foreground">{loadError}</p>
        ) : null}

        {!hasShifts && !loadError && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {studioHours.length === 0
                  ? "Todavía no te asignaron a una sucursal. Cuando el gimnasio lo haga, cargás acá los días y las horas."
                  : "Todavía no cargaste días y horas. Hacelo en Sucursales, dentro de la apertura de cada una."}
              </p>
              {studioHours.length > 0 && (
                <Link
                  href="/profesor/sucursales"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "mt-4 h-10 px-4"
                  )}
                >
                  Cargar sucursales
                </Link>
              )}
            </div>
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mes anterior"
              onClick={() => choose(new Date(year, month - 1, 1, 12))}
            >
              <ChevronLeft />
            </Button>
            <div className="text-center">
              <h2 className="font-heading text-2xl italic">
                {monthLabel(year, month)}
              </h2>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => choose(new Date())}
              >
                Ir a hoy
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mes siguiente"
              onClick={() => choose(new Date(year, month + 1, 1, 12))}
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day.id} className="py-1">
                {day.short}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((date) => {
              const blocks = blocksByWeekday.get(date.getDay()) ?? [];
              const selectedDay = sameLocalDay(date, selected);
              const isToday = sameLocalDay(date, today);
              const inMonth = date.getMonth() === month;
              const label = [
                WEEKDAYS.find((item) => item.id === date.getDay())?.full,
                date.getDate(),
                isToday ? "hoy" : null,
                blocks.length
                  ? blocks
                      .map(
                        (block) =>
                          `${block.studioName} de ${clock(block.startHour)} a ${clock(block.endHour)}`
                      )
                      .join(", ")
                  : "libre",
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  aria-label={label}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={selectedDay}
                  onClick={() => choose(date)}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center rounded-2xl py-1.5 text-sm transition-colors",
                    !inMonth && "opacity-40",
                    selectedDay
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "bg-primary/12 text-foreground"
                        : "hover:bg-muted"
                  )}
                >
                  <span className="tabular-nums leading-none">
                    {date.getDate()}
                  </span>
                  <span className="mt-1 flex h-3 items-center justify-center">
                    {blocks.length > 0 ? (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          selectedDay ? "bg-primary-foreground" : "bg-primary"
                        )}
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            El punto marca un día con sucursal. Tocá el día para ver el horario.
          </p>
        </section>

        <section className="mt-4 rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5">
          <h2 className="font-heading text-2xl italic">{dayHeading(selected)}</h2>
          {selectedBlocks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Libre</p>
          ) : (
            <>
              <ul className="mt-4 flex flex-col gap-2">
                {selectedBlocks.map((block) => (
                  <li key={`${block.studioId}:${block.startHour}`}>
                    <button
                      type="button"
                      onClick={() => setOpenBlock(block)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary/8 px-3 py-3 text-left transition-colors hover:bg-primary/14"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {block.studioName}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {clock(block.startHour)}–{clock(block.endHour)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Tocá la sucursal para ver los alumnos y el horario de cada uno.
              </p>
            </>
          )}
        </section>

        <Dialog
          open={openBlock !== null}
          onOpenChange={(next) => {
            if (!next) setOpenBlock(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            {openBlock ? (
              <>
                <DialogHeader>
                  <DialogTitle className="font-heading text-2xl italic">
                    {openBlock.studioName}
                  </DialogTitle>
                  <DialogDescription>
                    {`${dayHeading(selected)} · ${clock(openBlock.startHour)}–${clock(openBlock.endHour)}`}
                  </DialogDescription>
                </DialogHeader>
                {clients === null ? (
                  <p className="text-sm text-muted-foreground">
                    Cargando alumnos…
                  </p>
                ) : clientsError ? (
                  <p className="text-sm text-muted-foreground">{clientsError}</p>
                ) : openStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este día no tenés alumnos en este horario.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {openStudents.length === 1
                        ? "1 alumno"
                        : `${openStudents.length} alumnos`}
                    </p>
                    <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8">
                      {openStudents.map((student) => (
                        <li key={student.userId}>
                          <Link
                            href={`/profesor/${encodeURIComponent(student.userId)}`}
                            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                          >
                            <span className="min-w-0">
                              <span className="block font-medium">
                                {student.displayName}
                              </span>
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {scheduleLine(student.schedule)}
                              </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-primary" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
