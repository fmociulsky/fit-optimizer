"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Phone } from "lucide-react";
import { toast } from "sonner";
import { BackLink } from "@/components/back-link";
import { SearchCreateBar } from "@/components/search-create-bar";
import { SiteHeader } from "@/components/site-header";
import { TeacherStudentAssign } from "@/components/studio-assign";
import { TeacherHoursEditor } from "@/components/teacher-hours-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAYS } from "@/lib/labels";
import { matchesSearch } from "@/lib/search";
import {
  assignGymTeacher,
  createGymTeacher,
  deleteGymTeacher,
  listGymTeachers,
  loadGymTeacher,
  saveGymTeacherShifts,
  unassignGymTeacher,
  type GymTeacherDetail,
  type GymTeacherSummary,
} from "@/lib/studio";

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function weekdayShort(id: number) {
  return WEEKDAYS.find((item) => item.id === id)?.short ?? "Día";
}

function hoursSummary(
  shifts: { weekday: number; startHour: string; endHour: string }[]
) {
  if (!shifts.length) return "Sin horarios asignados";
  return [...shifts]
    .sort((a, b) => a.weekday - b.weekday)
    .map(
      (item) =>
        `${weekdayShort(item.weekday)} ${item.startHour}–${item.endHour}`
    )
    .join(" · ");
}

export function GymTeachersView() {
  const router = useRouter();
  const [rows, setRows] = useState<GymTeacherSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listGymTeachers()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createTeacher() {
    setBusy(true);
    try {
      const teacher = await createGymTeacher({
        displayName: name,
        phone,
        username,
        password: "1234",
      });
      toast.success("Profesor creado.");
      setCreating(false);
      router.push(`/estudio/profesores/${teacher.userId}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const visible = useMemo(
    () =>
      (rows ?? []).filter((item) =>
        matchesSearch(query, item.displayName, item.username, item.phone)
      ),
    [rows, query]
  );

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
        Cargando profesores…
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
            Profesores.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Buscá por nombre o usuario. Entrá a cada uno para ver sucursales,
            horarios, alumnos o darlo de baja.
          </p>
        </div>
        <SearchCreateBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Buscar por nombre o usuario"
          createLabel="Nuevo profesor"
          creating={creating}
          onToggleCreate={() => setCreating((open) => !open)}
        />
        {creating && (
          <div className="rounded-3xl border border-foreground/8 bg-card p-5">
            <p className="font-medium">Nuevo profesor</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nombre, teléfono y usuario. Entra a su panel con contraseña 1234.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gym-teacher-name">Nombre</Label>
                <Input
                  id="gym-teacher-name"
                  className="h-11 text-base"
                  placeholder="Nombre del profesor"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gym-teacher-phone">Teléfono</Label>
                <Input
                  id="gym-teacher-phone"
                  className="h-11 text-base"
                  type="tel"
                  inputMode="tel"
                  placeholder="11 5555-0000"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="gym-teacher-username">Usuario</Label>
                <Input
                  id="gym-teacher-username"
                  className="h-11 text-base"
                  autoComplete="off"
                  placeholder="usuario"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
            </div>
            <Button
              className="mt-3 h-11 px-5"
              disabled={busy}
              onClick={() => void createTeacher()}
            >
              {busy ? "Creando…" : "Crear"}
            </Button>
          </div>
        )}
        <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
          {visible.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              {rows.length === 0
                ? "Todavía no hay profesores en este gimnasio."
                : "Ningún profesor coincide con esa búsqueda."}
            </li>
          )}
          {visible.map((teacher) => (
            <li key={teacher.userId}>
              <Link
                href={`/estudio/profesores/${teacher.userId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
              >
                <p className="min-w-0 flex-1 truncate font-medium">
                  {teacher.displayName}
                </p>
                <p className="hidden min-w-0 max-w-[10rem] truncate text-sm text-muted-foreground sm:block">
                  {teacher.phone || teacher.username || "—"}
                </p>
                <p className="hidden min-w-0 flex-[1.2] truncate text-sm text-muted-foreground lg:block">
                  {teacher.branches.length
                    ? teacher.branches.map((item) => item.name).join(" · ")
                    : "Sin sucursal"}
                </p>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

export function GymTeacherDetailView({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<GymTeacherDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadGymTeacher(teacherId)
      .then((next) => {
        if (cancelled) return;
        setTeacher(next);
        setPick(next.available[0]?.studioId ?? "");
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  function apply(next: GymTeacherDetail) {
    setTeacher(next);
    setPick((current) =>
      next.available.some((item) => item.studioId === current)
        ? current
        : next.available[0]?.studioId ?? ""
    );
  }

  async function unassign(studioId: string, studioName: string) {
    if (!teacher || busy) return;
    const ok = window.confirm(
      `¿Quitar a ${teacher.displayName} de ${studioName}? Se borran sus horarios y las reservas de sus alumnos en esa sucursal.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      apply(
        await unassignGymTeacher({
          teacherUserId: teacher.userId,
          studioId,
        })
      );
      toast.success("Profesor desasignado de esa sucursal.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!teacher || busy) return;
    const ok = window.confirm(
      `¿Eliminar a ${teacher.displayName} del gimnasio? Se lo quita de todas las sucursales, con horarios y reservas.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteGymTeacher(teacher.userId);
      toast.success("Profesor eliminado.");
      router.push("/estudio/profesores");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-muted-foreground">{loadError}</p>
        <BackLink href="/estudio/profesores">Volver a profesores</BackLink>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando profesor…
      </div>
    );
  }

  const chosen = teacher.available.find((item) => item.studioId === pick);

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
        <header>
          <BackLink href="/estudio/profesores" />
          <h1 className="mt-2 font-heading text-4xl tracking-tight italic sm:text-5xl">
            {teacher.displayName}
          </h1>
          {teacher.phone ? (
            <p className="mt-2 flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4 shrink-0" />
              {teacher.phone}
            </p>
          ) : null}
          {teacher.username ? (
            <p className="mt-1 text-muted-foreground">
              Usuario {teacher.username}
            </p>
          ) : null}
        </header>

        <section>
          <h2 className="font-heading text-2xl italic">Sucursales</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Donde está asignado, con sus días y horarios. Podés quitarlo de una
            sucursal sin borrarlo del gimnasio.
          </p>
          <ul className="mt-4 space-y-3">
            {teacher.assigned.length === 0 && (
              <li className="rounded-2xl border border-foreground/8 bg-card p-4 text-sm text-muted-foreground">
                No está asignado a ninguna sucursal.
              </li>
            )}
            {teacher.assigned.map((branch) => (
              <li key={branch.studioId}>
                <details className="group rounded-2xl border border-foreground/8 bg-card open:pb-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="font-medium">{branch.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {hoursSummary(branch.shifts)}
                      </p>
                    </div>
                    <ChevronDown className="mt-1 size-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-foreground/8 px-4 pt-3">
                    <TeacherHoursEditor
                      className="mt-0"
                      dayHours={branch.dayHours}
                      shifts={branch.shifts}
                      saveLabel="Guardar horario"
                      onSave={async (next) => {
                        apply(
                          await saveGymTeacherShifts({
                            teacherUserId: teacher.userId,
                            studioId: branch.studioId,
                            shifts: next,
                          })
                        );
                      }}
                    />
                    <TeacherStudentAssign
                      studioId={branch.studioId}
                      teacherUserId={teacher.userId}
                      teacherName={teacher.displayName}
                      clients={teacher.clients.filter(
                        (item) => item.studioId === branch.studioId
                      )}
                      onSaved={() => {
                        void loadGymTeacher(teacher.userId).then(apply);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 h-11 px-4"
                      disabled={busy}
                      onClick={() => void unassign(branch.studioId, branch.name)}
                    >
                      Quitar de esta sucursal
                    </Button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {teacher.available.length > 0 && chosen && (
          <section className="rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">
              Asignar sucursal a {teacher.displayName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Elegí la sucursal y los días que trabaja. Después se puede
              cambiar el horario.
            </p>
            <div className="mt-3 max-w-xs space-y-1.5">
              <Label htmlFor="assign-branch">Sucursal</Label>
              <select
                id="assign-branch"
                className={fieldClass}
                value={pick}
                onChange={(event) => setPick(event.target.value)}
              >
                {teacher.available.map((branch) => (
                  <option key={branch.studioId} value={branch.studioId}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <TeacherHoursEditor
              key={chosen.studioId}
              dayHours={chosen.dayHours}
              shifts={[]}
              saveLabel="Asignar con estos horarios"
              onSave={async (next) => {
                apply(
                  await assignGymTeacher({
                    teacherUserId: teacher.userId,
                    studioId: chosen.studioId,
                    shifts: next,
                  })
                );
                toast.success("Profesor asignado a la sucursal.");
              }}
            />
          </section>
        )}

        <section className="border-t border-foreground/8 pt-6">
          <p className="text-sm text-muted-foreground">
            Al eliminarlo se quitan todas las asignaciones, horarios y reservas
            en este gimnasio.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="mt-3 h-11 px-5"
            disabled={busy}
            onClick={() => void remove()}
          >
            Eliminar profesor
          </Button>
        </section>
      </main>
    </div>
  );
}
