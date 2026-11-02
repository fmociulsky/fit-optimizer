"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useNow } from "@/components/use-now";
import { StudioBranchNav } from "@/components/studio-branch-nav";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mondayOfYmd, shiftYmd } from "@/lib/client-account";
import { isCurrentClassSlot } from "@/lib/hours";
import { formatClassDate, formatDayMonth, WEEKDAYS } from "@/lib/labels";
import {
  annulStudentTurn,
  enrollStudentWithCredit,
  loadWeekAgenda,
  removeStudentFromWaitlist,
  type DayAgendaSlot,
  type NextHourPerson,
  type RecoverableStudent,
  type WeekAgendaDay,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

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

function planChipClass(plan: NextHourPerson["turnPlan"]) {
  if (plan === "fixed") return "bg-sky-200 text-sky-950 ring-sky-500";
  if (plan === "week") return "bg-orange-300 text-orange-950 ring-orange-600";
  if (plan === "month") return "bg-violet-200 text-violet-950 ring-violet-400";
  return "bg-background ring-foreground/15";
}

const PLAN_LEGEND = [
  { label: "Días fijos", className: "bg-sky-200 ring-sky-500" },
  { label: "Por semana", className: "bg-orange-300 ring-orange-600" },
  { label: "Por mes", className: "bg-violet-200 ring-violet-400" },
] as const;

/** Más de 2 libres en verde, 1 o 2 en amarillo, sin cupo en rojo. */
function roomTone(free: number) {
  if (free > 2) return "bg-emerald-500/30 ring-1 ring-emerald-700/25";
  if (free > 0) return "bg-amber-300/55 ring-1 ring-amber-700/30";
  return "bg-red-500 ring-1 ring-red-800";
}

export function StudioWeekAgenda({ studioId }: { studioId: string }) {
  const [name, setName] = useState("");
  const [today, setToday] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [days, setDays] = useState<WeekAgendaDay[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [requestedWeek, setRequestedWeek] = useState<string | undefined>(
    undefined
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [waitlist, setWaitlist] = useState<{
    occursOn: string;
    hour: string;
    people: NextHourPerson[];
  } | null>(null);
  const [recoverable, setRecoverable] = useState<RecoverableStudent[]>([]);
  const [enroll, setEnroll] = useState<{
    occursOn: string;
    hour: string;
    openSeat: boolean;
    takenIds: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadWeekAgenda(studioId, requestedWeek)
      .then((next) => {
        if (cancelled) return;
        setName(next.name);
        setToday(next.today);
        setFrom(next.from);
        setTo(next.to);
        setDays(next.days);
        setWeekStart(next.weekStart);
        setRecoverable(next.recoverable);
        setError("");
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "No se pudo cargar la agenda."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studioId, requestedWeek]);

  async function annul(
    occursOn: string,
    slotStart: string,
    student: NextHourPerson
  ) {
    const key = `${occursOn}|${slotStart}|${student.userId}`;
    setPendingKey(key);
    setError("");
    try {
      await annulStudentTurn(studioId, student.userId, occursOn, slotStart);
      const next = await loadWeekAgenda(studioId, requestedWeek);
      setName(next.name);
      setToday(next.today);
      setFrom(next.from);
      setTo(next.to);
      setDays(next.days);
      setWeekStart(next.weekStart);
      setRecoverable(next.recoverable);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo anular el turno."
      );
    } finally {
      setPendingKey(null);
    }
  }

  async function dropFromWaitlist(person: NextHourPerson) {
    if (!waitlist) return;
    const key = `espera|${waitlist.occursOn}|${waitlist.hour}|${person.userId}`;
    setPendingKey(key);
    setError("");
    try {
      await removeStudentFromWaitlist(
        studioId,
        person.userId,
        waitlist.occursOn,
        waitlist.hour
      );
      const next = await loadWeekAgenda(studioId, requestedWeek);
      setName(next.name);
      setToday(next.today);
      setFrom(next.from);
      setTo(next.to);
      setDays(next.days);
      setWeekStart(next.weekStart);
      setRecoverable(next.recoverable);
      const people = waitlist.people.filter(
        (item) => item.userId !== person.userId
      );
      setWaitlist(people.length > 0 ? { ...waitlist, people } : null);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo sacar al alumno de la lista."
      );
    } finally {
      setPendingKey(null);
    }
  }

  async function enrollStudent(student: RecoverableStudent) {
    if (!enroll) return;
    const key = `anotar|${enroll.occursOn}|${enroll.hour}|${student.userId}`;
    setPendingKey(key);
    setError("");
    try {
      await enrollStudentWithCredit(
        studioId,
        student.userId,
        enroll.occursOn,
        enroll.hour
      );
      const next = await loadWeekAgenda(studioId, requestedWeek);
      setName(next.name);
      setToday(next.today);
      setFrom(next.from);
      setTo(next.to);
      setDays(next.days);
      setWeekStart(next.weekStart);
      setRecoverable(next.recoverable);
      setEnroll(null);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo anotar al alumno."
      );
    } finally {
      setPendingKey(null);
    }
  }

  const start = weekStart || (today ? mondayOfYmd(today) : "");
  const end = start ? shiftYmd(start, 6) : "";
  const now = useNow();
  const hours = [
    ...new Set(days.flatMap((day) => day.slots.map((slot) => slot.slotStart))),
  ].sort();
  const atStart = !start || !from || start <= from;
  const atEnd = !start || !to || shiftYmd(start, 7) > to;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <StudioBranchNav
          studioId={studioId}
          name={name || "Sucursal"}
          active="agenda"
        />
        {error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : null}
        {loading && days.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Cargando agenda…</p>
        ) : (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={atStart || loading || pendingKey !== null}
                onClick={() => setRequestedWeek(shiftYmd(start, -7))}
              >
                Atrás
              </Button>
              <p className="text-center text-sm font-medium">
                {start && end
                  ? `${formatDayMonth(start)} – ${formatDayMonth(end)}`
                  : ""}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={atEnd || loading || pendingKey !== null}
                onClick={() => setRequestedWeek(shiftYmd(start, 7))}
              >
                Adelante
              </Button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {PLAN_LEGEND.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-1.5 text-xs font-medium"
                >
                  <span
                    className={cn("size-3 rounded-sm ring-1", item.className)}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
            {hours.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Esta semana no tiene horarios.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <div
                  className="grid min-w-[64rem] gap-1"
                  style={{
                    gridTemplateColumns: "3.2rem repeat(7, minmax(0, 1fr))",
                  }}
                >
                  <div />
                  {days.map((day) => {
                    const label =
                      WEEKDAYS.find((item) => item.id === day.weekday)?.short ??
                      "";
                    return (
                      <div
                        key={day.occursOn}
                        className={cn(
                          "rounded-xl px-1 py-2 text-center",
                          day.occursOn === today && "bg-primary/10"
                        )}
                      >
                        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          {label}
                        </p>
                        <p className="text-sm font-medium">
                          {Number(day.occursOn.slice(8))}
                        </p>
                      </div>
                    );
                  })}
                  {hours.map((hour) => (
                    <div key={hour} className="contents">
                      <p className="flex items-start pt-2 text-xs font-medium">
                        {hour}
                      </p>
                      {days.map((day) => {
                        const slot = day.slots.find(
                          (item) => item.slotStart === hour
                        );
                        if (!slot) {
                          return <div key={day.occursOn} />;
                        }
                        const students = studentsInSlot(slot).filter(
                          (item) => !item.absent
                        );
                        const teacherNames = slot.teachers
                          .map((item) => item.name)
                          .join(" · ");
                        const past = Boolean(today && day.occursOn < today);
                        const current = isCurrentClassSlot(day.occursOn, hour, now);
                        const canEnroll = !past && slot.teachers.length > 0;
                        const waiting = slot.waiting ?? [];
                        return (
                          <div
                            key={day.occursOn}
                            className={cn(
                              "relative min-h-16 rounded-xl px-1.5 py-1.5",
                              roomTone(slot.free ?? 0),
                              (canEnroll || waiting.length > 0) && "pb-8",
                              current &&
                                "outline outline-2 -outline-offset-2 outline-foreground"
                            )}
                          >
                            {current ? (
                              <p className="text-[10px] font-semibold uppercase tracking-wide">
                                Ahora
                              </p>
                            ) : null}
                            <p className="truncate text-[10px] font-medium leading-tight">
                              {teacherNames
                                ? `Profe: ${teacherNames}`
                                : "Sin profe"}
                            </p>
                            {slot.occupancy ? (
                              <p className="text-[11px] font-medium leading-tight">
                                {slot.occupancy}
                              </p>
                            ) : null}
                            {canEnroll ? (
                              <button
                                type="button"
                                disabled={pendingKey !== null}
                                aria-label={`Anotar alumno el ${formatClassDate(day.occursOn)} a las ${hour}`}
                                onClick={() =>
                                  setEnroll({
                                    occursOn: day.occursOn,
                                    hour,
                                    openSeat: (slot.free ?? 0) > 0,
                                    takenIds: [
                                      ...students.map((item) => item.userId),
                                      ...waiting.map((item) => item.userId),
                                    ],
                                  })
                                }
                                className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-background text-sm leading-none font-semibold text-foreground shadow-sm ring-1 ring-foreground/25 hover:bg-foreground hover:text-background disabled:opacity-40"
                              >
                                <span aria-hidden="true">+</span>
                              </button>
                            ) : null}
                            {waiting.length > 0 ? (
                              <button
                                type="button"
                                aria-label={`Lista de espera del ${formatClassDate(day.occursOn)} a las ${hour}, ${waiting.length}`}
                                onClick={() =>
                                  setWaitlist({
                                    occursOn: day.occursOn,
                                    hour,
                                    people: waiting,
                                  })
                                }
                                className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-foreground/25 hover:bg-foreground hover:text-background"
                              >
                                <List className="size-3.5" aria-hidden="true" />
                              </button>
                            ) : null}
                            {students.length > 0 ? (
                              <ul className="mt-1 space-y-1">
                                {students.map((student) => {
                                  const key = `${day.occursOn}|${hour}|${student.userId}`;
                                  const pending = pendingKey === key;
                                  return (
                                    <li
                                      key={student.userId}
                                      className={cn(
                                        "flex items-center gap-1 rounded-md px-1.5 py-1 ring-1",
                                        planChipClass(student.turnPlan)
                                      )}
                                    >
                                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight">
                                        {student.name}
                                      </span>
                                      {past ? null : (
                                        <button
                                          type="button"
                                          disabled={pending || pendingKey !== null}
                                          aria-label={`Anular el turno de ${student.name}`}
                                          onClick={() =>
                                            void annul(day.occursOn, hour, student)
                                          }
                                          className="grid size-4 shrink-0 place-items-center rounded bg-foreground/10 text-[12px] leading-none font-semibold hover:bg-foreground/20 disabled:opacity-40"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      <Dialog
        open={enroll !== null}
        onOpenChange={(open) => {
          if (!open) setEnroll(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl italic">
              {enroll && !enroll.openSeat
                ? "Anotar en lista de espera"
                : "Anotar alumno"}
            </DialogTitle>
            <DialogDescription>
              {enroll
                ? `${formatClassDate(enroll.occursOn)} a las ${enroll.hour}. ${
                    enroll.openSeat
                      ? "Hay lugar: queda en el turno."
                      : "No hay lugar: queda en la lista de espera."
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {enroll &&
          recoverable.filter((item) => !enroll.takenIds.includes(item.userId))
            .length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nadie tiene créditos para recuperar.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {recoverable
                .filter(
                  (item) => !enroll?.takenIds.includes(item.userId)
                )
                .map((student) => (
                  <li
                    key={student.userId}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 ring-1",
                      planChipClass(student.turnPlan)
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{student.name}</p>
                      <p className="text-xs">
                        {student.credits === 1
                          ? "1 crédito"
                          : `${student.credits} créditos`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pendingKey !== null}
                      aria-label={
                        enroll?.openSeat
                          ? `Anotar a ${student.name}`
                          : `Anotar a ${student.name} en la lista de espera`
                      }
                      onClick={() => void enrollStudent(student)}
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-background text-sm leading-none font-semibold text-foreground shadow-sm ring-1 ring-foreground/25 hover:bg-foreground hover:text-background disabled:opacity-40"
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={waitlist !== null}
        onOpenChange={(open) => {
          if (!open) setWaitlist(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl italic">
              Lista de espera
            </DialogTitle>
            <DialogDescription>
              {waitlist
                ? `${formatClassDate(waitlist.occursOn)} a las ${waitlist.hour}. Entran en este orden si se libera un cupo.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2">
            {waitlist?.people.map((person, index) => {
              const key = `espera|${waitlist.occursOn}|${waitlist.hour}|${person.userId}`;
              return (
                <li key={person.userId} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {person.name}
                  </span>
                  <button
                    type="button"
                    disabled={pendingKey !== null}
                    aria-label={`Sacar a ${person.name} de la lista de espera`}
                    onClick={() => void dropFromWaitlist(person)}
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground/10 text-sm leading-none font-semibold hover:bg-foreground/20 disabled:opacity-40"
                  >
                    {pendingKey === key ? "…" : "×"}
                  </button>
                </li>
              );
            })}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
