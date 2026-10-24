"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { weekdayName } from "@/lib/labels";
import {
  cancelClientAbsenceToday,
  loadClientTodayHome,
  markClientAbsenceToday,
  type ClientTodayHome,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export function ClientDayHome() {
  const [home, setHome] = useState<ClientTodayHome | null | undefined>(
    undefined
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void loadClientTodayHome()
      .then((next) => {
        if (!cancelled) setHome(next);
      })
      .catch(() => {
        if (!cancelled) setHome(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleAbsence(absent: boolean) {
    startTransition(() => {
      void (absent ? markClientAbsenceToday() : cancelClientAbsenceToday())
        .then((next) => {
          setHome(next);
          toast.success(
            absent
              ? "Avisaste que hoy no vas. El cupo queda libre."
              : "Cancelaste el aviso: volvés a figurar en la agenda."
          );
        })
        .catch((error: unknown) => {
          toast.error(errorMessage(error));
        });
    });
  }

  if (home === undefined) {
    return (
      <div className="mt-6 rounded-3xl border border-foreground/8 bg-card px-5 py-4 text-sm text-muted-foreground">
        Cargando tu día…
      </div>
    );
  }

  if (!home) return null;

  if (home.today) {
    const absent = home.today.absent;
    return (
      <section
        className={
          absent
            ? "mt-6 rounded-3xl border border-foreground/10 bg-muted/40 px-5 py-5"
            : "mt-6 rounded-3xl border border-primary/25 bg-primary/8 px-5 py-5"
        }
      >
        <p
          className={
            absent
              ? "text-sm font-medium tracking-wide text-muted-foreground uppercase"
              : "text-sm font-medium tracking-wide text-primary uppercase"
          }
        >
          Hoy · {home.studioName}
        </p>
        <h2 className="mt-1 font-heading text-3xl tracking-tight italic sm:text-4xl">
          {absent
            ? "Hoy no vas"
            : `Entrenás a las ${home.today.slotStart}`}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {absent
            ? `Tu turno de las ${home.today.slotStart} queda libre por hoy.`
            : home.today.teacherName
              ? `Con ${home.today.teacherName}.`
              : "Todavía no tenés profesor asignado para ese turno."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {absent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => toggleAbsence(false)}
            >
              Al final sí voy
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => toggleAbsence(true)}
            >
              Hoy no voy
            </Button>
          )}
          <Link
            href="/turnos"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <CalendarClock className="size-4" />
            Ver agenda
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-foreground/8 bg-card px-5 py-5">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        Hoy · {home.studioName}
      </p>
      <h2 className="mt-1 font-heading text-3xl tracking-tight italic sm:text-4xl">
        Hoy no tenés clase
      </h2>
      <p className="mt-2 text-muted-foreground">
        {home.next
          ? `Próxima: ${weekdayName(home.next.weekday)} a las ${home.next.slotStart}${
              home.next.teacherName ? ` con ${home.next.teacherName}` : ""
            }.`
          : "Todavía no elegiste días de asistencia."}
      </p>
      <Link
        href="/turnos"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <CalendarClock className="size-4" />
        Ver agenda
      </Link>
    </section>
  );
}
