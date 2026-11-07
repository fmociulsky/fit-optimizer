"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { useAppStore } from "@/components/app-provider";
import { useNow } from "@/components/use-now";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  classSlotPassed,
  formatHour,
  isCurrentClassSlot,
  parseHour,
} from "@/lib/hours";
import { WEEKDAYS, weekdayName } from "@/lib/labels";
import {
  localNoon,
  monthCells,
  monthLabel,
  sameLocalDay,
} from "@/lib/agenda";
import { formatBillingYmd, todayBillingYmd } from "@/lib/client-account";
import {
  listTeacherClientAbsences,
  loadTeacherDayAgenda,
  loadTeacherStudioHours,
  markTeacherStudentAttendance,
  type StudioAbsenceView,
  type TeacherDayAgenda,
  type TeacherDaySlot,
  type TeacherDaySlotStudent,
  type TeacherSlotAttendance,
  type TeacherStudioHours,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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

function slotKey(slot: Pick<TeacherDaySlot, "studioId" | "slotStart">) {
  return `${slot.studioId}:${slot.slotStart}`;
}

export function ProfessionalWeek() {
  const { ready, account } = useAppStore();
  const now = useNow();
  const [studioHours, setStudioHours] = useState<TeacherStudioHours[] | null>(
    null
  );
  const [dayAgenda, setDayAgenda] = useState<TeacherDayAgenda | null>(null);
  const [todayAgenda, setTodayAgenda] = useState<TeacherDayAgenda | null>(null);
  const [absences, setAbsences] = useState<StudioAbsenceView[]>([]);
  const [loadError, setLoadError] = useState("");
  const [agendaError, setAgendaError] = useState("");
  const [selected, setSelected] = useState(() => localNoon(new Date()));
  const [cursor, setCursor] = useState(() => localNoon(new Date()));
  const [openSlot, setOpenSlot] = useState<TeacherDaySlot | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const selectedYmd = toYmd(selected);
  const todayYmd = todayBillingYmd();

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
    void listTeacherClientAbsences()
      .then((rows) => {
        if (!cancelled) setAbsences(rows);
      })
      .catch(() => {
        if (!cancelled) setAbsences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [account?.role, ready]);

  useEffect(() => {
    if (!ready || account?.role !== "professional") return;
    let cancelled = false;
    setAgendaError("");
    void loadTeacherDayAgenda(selectedYmd)
      .then((agenda) => {
        if (cancelled) return;
        setDayAgenda(agenda);
        if (selectedYmd === todayYmd) setTodayAgenda(agenda);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAgendaError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los turnos del día."
        );
        setDayAgenda({ occursOn: selectedYmd, weekday: selected.getDay(), slots: [] });
      });
    if (selectedYmd !== todayYmd) {
      void loadTeacherDayAgenda(todayYmd)
        .then((agenda) => {
          if (!cancelled) setTodayAgenda(agenda);
        })
        .catch(() => {
          if (!cancelled) setTodayAgenda(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [account?.role, ready, selected, selectedYmd, todayYmd]);

  const shiftWeekdays = useMemo(() => {
    const set = new Set<number>();
    for (const row of studioHours ?? []) {
      for (const shift of row.shifts) set.add(shift.weekday);
    }
    return set;
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
  const hasShifts = shiftWeekdays.size > 0;

  function choose(date: Date) {
    const next = localNoon(date);
    setSelected(next);
    setCursor(next);
    setOpenSlot(null);
  }

  function patchStudentAttendance(
    occursOn: string,
    studioId: string,
    slotStart: string,
    userId: string,
    attendance: TeacherSlotAttendance,
    turnId: string | null
  ) {
    const patch = (agenda: TeacherDayAgenda | null) => {
      if (!agenda || agenda.occursOn !== occursOn) return agenda;
      return {
        ...agenda,
        slots: agenda.slots.map((slot) => {
          if (slot.studioId !== studioId || slot.slotStart !== slotStart) {
            return slot;
          }
          return {
            ...slot,
            students: slot.students.map((student) =>
              student.userId === userId
                ? {
                    ...student,
                    attendance,
                    turnId: turnId ?? student.turnId,
                  }
                : student
            ),
          };
        }),
      };
    };
    setDayAgenda((current) => patch(current));
    setTodayAgenda((current) => patch(current));
    setOpenSlot((current) => {
      if (
        !current ||
        current.studioId !== studioId ||
        current.slotStart !== slotStart
      ) {
        return current;
      }
      return {
        ...current,
        students: current.students.map((student) =>
          student.userId === userId
            ? { ...student, attendance, turnId: turnId ?? student.turnId }
            : student
        ),
      };
    });
  }

  async function markAttendance(
    slot: TeacherDaySlot,
    student: TeacherDaySlotStudent,
    attendance: TeacherSlotAttendance
  ) {
    const key = `${slot.studioId}:${student.userId}:${slot.slotStart}:${attendance}`;
    if (savingKey) return;
    setSavingKey(key);
    try {
      const result = await markTeacherStudentAttendance({
        studioId: slot.studioId,
        clientUserId: student.userId,
        occursOn: selectedYmd,
        slotStart: slot.slotStart,
        attendance,
      });
      patchStudentAttendance(
        selectedYmd,
        slot.studioId,
        slot.slotStart,
        student.userId,
        attendance,
        result.turnId
      );
      toast.success(
        attendance === "present"
          ? `${student.displayName}: presente`
          : `${student.displayName}: ausente`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la asistencia."
      );
    } finally {
      setSavingKey(null);
    }
  }

  const nowSlot = useMemo(() => {
    const slots = todayAgenda?.slots ?? [];
    return (
      slots.find((slot) =>
        isCurrentClassSlot(todayYmd, slot.slotStart, now)
      ) ?? null
    );
  }, [now, todayAgenda, todayYmd]);

  const todayAbsences = absences.filter((item) => item.absentOn === todayYmd);
  const upcomingAbsences = absences.filter(
    (item) => item.absentOn > todayYmd
  );

  if (!ready || studioHours === null) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando tu agenda…
      </div>
    );
  }

  const openPast = openSlot
    ? classSlotPassed(selectedYmd, openSlot.slotStart, now)
    : false;

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
          El turno de ahora, los horarios del día y la asistencia de tus
          alumnos.
        </p>

        {nowSlot ? (
          <section className="mt-6 rounded-3xl border border-primary/25 bg-primary/8 px-5 py-5">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Ahora
            </p>
            <h2 className="mt-1 font-heading text-3xl tracking-tight italic sm:text-4xl">
              {slotLabel(nowSlot.slotStart)}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {nowSlot.studioName}
              {" · "}
              {nowSlot.students.length === 0
                ? "sin alumnos"
                : nowSlot.students.length === 1
                  ? "1 alumno"
                  : `${nowSlot.students.length} alumnos`}
              {nowSlot.students.filter((item) => item.clientAbsent).length > 0
                ? ` · ${
                    nowSlot.students.filter((item) => item.clientAbsent).length
                  } avisó`
                : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                choose(new Date());
                setOpenSlot(nowSlot);
              }}
            >
              Ver alumnos
            </Button>
          </section>
        ) : null}

        {todayAbsences.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-500/12 px-4 py-4">
            <p className="font-medium text-amber-950 dark:text-amber-100">
              Hoy no vienen
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-950/85 dark:text-amber-50/85">
              {todayAbsences.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{item.clientName}</span>
                  {` · ${item.slotStart}`}
                  {item.studioName ? ` · ${item.studioName}` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {upcomingAbsences.length > 0 ? (
          <section className="mt-4 rounded-2xl border border-foreground/8 bg-card px-4 py-4">
            <p className="font-medium">Próximas ausencias</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {upcomingAbsences.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-foreground">
                    {item.clientName}
                  </span>
                  {` · ${formatBillingYmd(item.absentOn)} ${item.slotStart}`}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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
              const hasShift = shiftWeekdays.has(date.getDay());
              const selectedDay = sameLocalDay(date, selected);
              const isToday = sameLocalDay(date, today);
              const inMonth = date.getMonth() === month;
              const label = [
                WEEKDAYS.find((item) => item.id === date.getDay())?.full,
                date.getDate(),
                isToday ? "hoy" : null,
                hasShift ? "con turnos" : "libre",
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
                    {hasShift ? (
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
            El punto marca un día con sucursal. Tocá el día para ver los turnos
            por hora.
          </p>
        </section>

        <section className="mt-4 rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5">
          <h2 className="font-heading text-2xl italic">{dayHeading(selected)}</h2>
          {agendaError ? (
            <p className="mt-3 text-sm text-muted-foreground">{agendaError}</p>
          ) : dayAgenda === null ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Cargando turnos…
            </p>
          ) : dayAgenda.slots.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Libre</p>
          ) : (
            <>
              <ul className="mt-4 flex flex-col gap-2">
                {dayAgenda.slots.map((slot) => {
                  const current = isCurrentClassSlot(
                    selectedYmd,
                    slot.slotStart,
                    now
                  );
                  const past = classSlotPassed(
                    selectedYmd,
                    slot.slotStart,
                    now
                  );
                  const absentCount = slot.students.filter(
                    (item) => item.clientAbsent
                  ).length;
                  const markedCount = slot.students.filter(
                    (item) => item.attendance
                  ).length;
                  return (
                    <li key={slotKey(slot)}>
                      <button
                        type="button"
                        onClick={() => setOpenSlot(slot)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                          current
                            ? "border border-primary/35 bg-primary/12 hover:bg-primary/16"
                            : "bg-primary/8 hover:bg-primary/14"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {slotLabel(slot.slotStart)}
                            </span>
                            {current ? (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                                Ahora
                              </span>
                            ) : null}
                            {past ? (
                              <span className="text-xs text-muted-foreground">
                                Ya fue
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {slot.studioName}
                            {" · "}
                            {slot.students.length === 0
                              ? "sin alumnos"
                              : slot.students.length === 1
                                ? "1 alumno"
                                : `${slot.students.length} alumnos`}
                            {absentCount > 0
                              ? ` · ${absentCount} avisó`
                              : ""}
                            {past && slot.students.length > 0
                              ? ` · ${markedCount}/${slot.students.length} asistencia`
                              : ""}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-primary" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Tocá un horario para ver los alumnos
                {selectedYmd <= todayYmd
                  ? " y marcar asistencia en los turnos que ya pasaron"
                  : ""}
                .
              </p>
            </>
          )}
        </section>

        <Dialog
          open={openSlot !== null}
          onOpenChange={(next) => {
            if (!next) setOpenSlot(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            {openSlot ? (
              <>
                <DialogHeader>
                  <DialogTitle className="font-heading text-2xl italic">
                    {slotLabel(openSlot.slotStart)}
                  </DialogTitle>
                  <DialogDescription>
                    {`${dayHeading(selected)} · ${openSlot.studioName}`}
                    {openPast ? " · Ya fue" : ""}
                  </DialogDescription>
                </DialogHeader>
                {openSlot.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este horario no tenés alumnos.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {openSlot.students.length === 1
                        ? "1 alumno"
                        : `${openSlot.students.length} alumnos`}
                      {openPast
                        ? " · Marcá quién vino"
                        : ""}
                    </p>
                    <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8">
                      {openSlot.students.map((student) => {
                        const savingPresent =
                          savingKey ===
                          `${openSlot.studioId}:${student.userId}:${openSlot.slotStart}:present`;
                        const savingAbsent =
                          savingKey ===
                          `${openSlot.studioId}:${student.userId}:${openSlot.slotStart}:absent`;
                        return (
                          <li key={student.userId} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <Link
                                href={`/profesor/${encodeURIComponent(student.userId)}`}
                                className="min-w-0 flex-1 transition-colors hover:text-primary"
                              >
                                <span
                                  className={cn(
                                    "block font-medium",
                                    student.clientAbsent &&
                                      "text-muted-foreground line-through opacity-70"
                                  )}
                                >
                                  {student.displayName}
                                </span>
                                <span className="mt-1 block text-sm text-muted-foreground">
                                  {student.clientAbsent
                                    ? "Avisó que no va"
                                    : student.attendance === "present"
                                      ? "Presente"
                                      : student.attendance === "absent"
                                        ? "Ausente"
                                        : openPast
                                          ? "Sin marcar"
                                          : weekdayName(selected.getDay())}
                                </span>
                              </Link>
                              <ChevronRight className="mt-1 size-4 shrink-0 text-primary" />
                            </div>
                            {openPast && !student.clientAbsent ? (
                              <div className="mt-3 flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    student.attendance === "present"
                                      ? "default"
                                      : "outline"
                                  }
                                  className={cn(
                                    "h-9 flex-1",
                                    student.attendance === "present" &&
                                      "bg-emerald-600 hover:bg-emerald-600"
                                  )}
                                  disabled={Boolean(savingKey)}
                                  onClick={() =>
                                    void markAttendance(
                                      openSlot,
                                      student,
                                      "present"
                                    )
                                  }
                                >
                                  {savingPresent ? "…" : "Presente"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    student.attendance === "absent"
                                      ? "default"
                                      : "outline"
                                  }
                                  className={cn(
                                    "h-9 flex-1",
                                    student.attendance === "absent" &&
                                      "bg-red-600 hover:bg-red-600"
                                  )}
                                  disabled={Boolean(savingKey)}
                                  onClick={() =>
                                    void markAttendance(
                                      openSlot,
                                      student,
                                      "absent"
                                    )
                                  }
                                >
                                  {savingAbsent ? "…" : "Ausente"}
                                </Button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
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
