"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { SearchCreateBar } from "@/components/search-create-bar";
import { SiteHeader } from "@/components/site-header";
import {
  ClientTeacherAssign,
  TeacherStudentAssign,
} from "@/components/studio-assign";
import { StudioBranchNav } from "@/components/studio-branch-nav";
import {
  StudioClientEditDialog,
  StudioClientForm,
  type StudioClientDraft,
} from "@/components/studio-client-form";
import { TeacherHoursEditor } from "@/components/teacher-hours-editor";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEX_LABEL, studioKindsLabel, WEEKDAYS } from "@/lib/labels";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import {
  assignTeacherToBranch,
  createStudioTeacher,
  deleteStudioClient,
  listAssignableTeachers,
  loadStudioDashboard,
  saveTeacherShifts,
  unassignTeacherFromBranch,
  type AssignableTeacher,
  type StudioDashboard,
  type StudioPerson,
} from "@/lib/studio";
import type { Sex } from "@/lib/types";

function weekdayLabel(id: number) {
  return WEEKDAYS.find((item) => item.id === id)?.full ?? "Día";
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export function StudioPeopleView({
  studioId,
  section,
}: {
  studioId: string;
  section: "profesores" | "alumnos";
}) {
  const [dash, setDash] = useState<StudioDashboard | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
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

  if (loadError) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (!dash) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando sucursal…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8">
        <StudioBranchNav
          studioId={studioId}
          name={dash.studio.name}
          active={section}
        />
        {section === "profesores" ? (
          <StudioTeachersCard dash={dash} onChange={setDash} />
        ) : (
          <StudioClientsCard dash={dash} onChange={setDash} />
        )}
      </main>
    </div>
  );
}

function StudioTeachersCard({
  dash,
  onChange,
}: {
  dash: StudioDashboard;
  onChange: (next: StudioDashboard) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignable, setAssignable] = useState<AssignableTeacher[]>([]);
  const [pick, setPick] = useState("");
  const [assignQuery, setAssignQuery] = useState("");
  const teachers = dash.people.filter((item) => item.role === "teacher");
  const assigned = teachers.filter((item) => !item.pending && item.userId);
  const pending = teachers.filter((item) => item.pending);
  const visibleAssigned = useMemo(
    () =>
      assigned.filter((item) =>
        matchesSearch(query, item.displayName, item.phone)
      ),
    [assigned, query]
  );
  const visiblePending = useMemo(
    () =>
      pending.filter((item) =>
        matchesSearch(query, item.displayName, item.phone)
      ),
    [pending, query]
  );
  const assignOptions = useMemo(
    () =>
      assignable.filter((item) =>
        matchesSearch(
          assignQuery,
          item.displayName,
          item.phone,
          ...item.branchNames
        )
      ),
    [assignable, assignQuery]
  );

  useEffect(() => {
    let cancelled = false;
    void listAssignableTeachers(dash.studio.id)
      .then((rows) => {
        if (cancelled) return;
        setAssignable(rows);
        setPick((current) =>
          current && rows.some((row) => row.userId === current) ? current : ""
        );
      })
      .catch(() => {
        if (!cancelled) setAssignable([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dash.studio.id, assigned.length]);

  async function createTeacher() {
    if (!sex) {
      toast.error("Elegí el género del profesor.");
      return;
    }
    setBusy(true);
    try {
      onChange(
        await createStudioTeacher({
          studioId: dash.studio.id,
          displayName: name,
          phone,
          username,
          password: "1234",
          sex,
        })
      );
      setName("");
      setPhone("");
      setUsername("");
      setSex(null);
      setCreating(false);
      toast.success("Profesor creado y asignado a esta sucursal.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function assignExisting() {
    if (!pick || busy) return;
    setBusy(true);
    try {
      onChange(
        await assignTeacherToBranch({
          studioId: dash.studio.id,
          teacherUserId: pick,
        })
      );
      setPick("");
      setAssignQuery("");
      toast.success("Profesor asignado a esta sucursal.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function unassign(person: StudioPerson) {
    if (!person.userId || busy) return;
    const ok = window.confirm(
      `¿Quitar a ${person.displayName} de ${dash.studio.name}? Se borran sus horarios y las reservas de sus alumnos en esta sucursal.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      onChange(
        await unassignTeacherFromBranch({
          studioId: dash.studio.id,
          teacherUserId: person.userId,
        })
      );
      toast.success("Profesor desasignado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="font-heading text-2xl italic">Profesores</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Los de esta sucursal. Buscá por nombre o abrí cada uno para ver
        horarios y asignar alumnos.
      </p>
      <div className="mt-4">
        <SearchCreateBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Buscar por nombre"
          createLabel="Nuevo profesor"
          creating={creating}
          onToggleCreate={() => setCreating((open) => !open)}
        />
      </div>
      {creating && (
        <div className="mt-4 rounded-2xl border border-foreground/8 bg-card p-4">
          <p className="font-medium">Asignar un profesor nuevo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nombre, teléfono y usuario. Queda asignado a esta sucursal y entra
            con contraseña 1234.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="teacher-name">Nombre</Label>
              <Input
                id="teacher-name"
                className="h-11 text-base"
                placeholder="Nombre del profesor"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-phone">Teléfono</Label>
              <Input
                id="teacher-phone"
                className="h-11 text-base"
                type="tel"
                inputMode="tel"
                placeholder="11 5555-0000"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="teacher-username">Usuario</Label>
              <Input
                id="teacher-username"
                className="h-11 text-base"
                autoComplete="off"
                placeholder="usuario"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Género</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(SEX_LABEL) as Sex[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSex(option)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                      sex === option
                        ? "border-primary bg-primary/8 ring-1 ring-primary"
                        : "border-border bg-background hover:border-primary/40"
                    )}
                  >
                    {SEX_LABEL[option]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button
            className="mt-3 h-11 px-5"
            disabled={busy}
            onClick={() => void createTeacher()}
          >
            {busy ? "Creando…" : "Crear y asignar"}
          </Button>
        </div>
      )}
      <ul className="mt-4 divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
        {visibleAssigned.length === 0 && visiblePending.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            {assigned.length === 0 && pending.length === 0
              ? "Todavía no hay profesores asignados."
              : "Ningún profesor coincide con esa búsqueda."}
          </li>
        )}
        {visibleAssigned.map((person) => {
          const teacherId = person.userId!;
          const shifts = dash.shifts.filter(
            (item) => item.teacherUserId === teacherId
          );
          const studentCount = dash.people.filter(
            (item) =>
              item.role === "client" && item.assignedTeacherUserId === teacherId
          ).length;
          return (
            <li key={teacherId}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <p className="min-w-0 flex-1 truncate font-medium">
                    {person.displayName}
                    {!person.active ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Desactivado
                      </span>
                    ) : null}
                  </p>
                  <p className="hidden min-w-0 max-w-[10rem] truncate text-sm text-muted-foreground sm:block">
                    {person.phone || "—"}
                  </p>
                  <p className="hidden min-w-0 max-w-[8rem] truncate text-sm text-muted-foreground lg:block">
                    {studentCount === 0
                      ? "Sin alumnos"
                      : `${studentCount} alumno${studentCount === 1 ? "" : "s"}`}
                  </p>
                  <p className="hidden min-w-0 flex-[1.4] truncate text-sm text-muted-foreground xl:block">
                    {hoursSummary(shifts)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 px-3"
                    disabled={busy}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void unassign(person);
                    }}
                  >
                    Quitar
                  </Button>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-foreground/8 px-4 pt-3 pb-4">
                  {person.phone ? (
                    <p className="mb-2 text-sm text-muted-foreground sm:hidden">
                      {person.phone}
                    </p>
                  ) : null}
                  <div>
                    <p className="font-medium">Días y horarios</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Cuándo trabaja en esta sucursal.
                    </p>
                    <TeacherHoursEditor
                      className="mt-3"
                      dayHours={dash.studio.dayHours}
                      shifts={shifts}
                      saveLabel="Guardar horario de este profesor"
                      onSave={async (next) => {
                        onChange(
                          await saveTeacherShifts(dash.studio.id, teacherId, next)
                        );
                      }}
                    />
                  </div>
                  <TeacherStudentAssign
                    studioId={dash.studio.id}
                    teacherUserId={teacherId}
                    teacherName={person.displayName}
                    clients={dash.people.filter((item) => item.role === "client")}
                    onSaved={onChange}
                  />
                </div>
              </details>
            </li>
          );
        })}
        {visiblePending.map((person) => (
          <li key={person.code} className="flex items-center gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 truncate font-medium">
              {person.displayName}
            </p>
            <p className="hidden min-w-0 max-w-[10rem] truncate text-sm text-muted-foreground sm:block">
              {person.phone || "Pendiente"}
            </p>
            <PersonRow person={person} />
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-2xl border border-foreground/8 bg-card p-4">
        <p className="font-medium">Asignar un profesor</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Buscá por nombre entre los que todavía no están en esta sucursal.
        </p>
        {assignable.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay profesores sin asignar. Creá uno nuevo o quitá a alguien de
            otra sucursal.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="assign-teacher-search">Nombre</Label>
              <Input
                id="assign-teacher-search"
                className="h-11 text-base"
                value={assignQuery}
                onChange={(event) => {
                  const next = event.target.value;
                  setAssignQuery(next);
                  setPick("");
                }}
                placeholder="Escribí el nombre"
                autoComplete="off"
              />
            </div>
            <ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/8">
              {assignOptions.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-muted-foreground">
                  Ningún profesor disponible coincide con esa búsqueda.
                </li>
              ) : (
                assignOptions.map((teacher) => {
                  const on = pick === teacher.userId;
                  return (
                    <li key={teacher.userId}>
                      <button
                        type="button"
                        onClick={() => setPick(teacher.userId)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                          on
                            ? "bg-primary/8"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {teacher.displayName}
                        </span>
                        {teacher.branchNames.length > 0 && (
                          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                            {teacher.branchNames.join(", ")}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <Button
              className="h-11 px-5"
              disabled={busy || !pick}
              onClick={() => void assignExisting()}
            >
              {busy ? "Asignando…" : "Asignar"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function StudioClientsCard({
  dash,
  onChange,
}: {
  dash: StudioDashboard;
  onChange: (next: StudioDashboard) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StudioClientDraft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const teachers = dash.people.filter(
    (item) => item.role === "teacher" && item.userId && item.active
  );
  const clients = dash.people.filter((item) => item.role === "client");
  const visibleClients = useMemo(
    () =>
      clients.filter((item) =>
        matchesSearch(query, item.displayName, item.email, item.username)
      ),
    [clients, query]
  );

  function draftFromPerson(
    person: StudioPerson,
    bookings: { weekday: number; slotStart: string }[]
  ): StudioClientDraft | null {
    if (!person.userId) return null;
    return {
      userId: person.userId,
      displayName: person.displayName,
      phone: person.phone,
      email: person.email,
      birthDate: person.birthDate,
      activities: person.activities,
      sessionsPerWeek: person.sessionsPerWeek,
      assignedTeacherUserId: person.assignedTeacherUserId,
      picks: bookings.map((item) => ({
        weekday: item.weekday,
        slotStart: item.slotStart,
      })),
    };
  }

  async function removeClient(person: StudioPerson) {
    const ok = window.confirm(
      `¿Eliminar a ${person.displayName} de esta sucursal? Se borran sus días reservados.`
    );
    if (!ok) return;
    try {
      onChange(
        await deleteStudioClient({
          studioId: dash.studio.id,
          clientUserId: person.userId,
          inviteCode: person.code,
        })
      );
      if (editing?.userId && editing.userId === person.userId) {
        setEditing(null);
      }
      toast.success("Alumno eliminado.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl italic">Alumnos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Los de esta sucursal. Buscá por nombre o email, o abrí cada uno para
          asignarle un profesor.
        </p>
      </div>
      <SearchCreateBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Buscar por nombre o email"
        createLabel="Nuevo alumno"
        creating={creating}
        onToggleCreate={() => setCreating((open) => !open)}
      />
      {creating && (
        <StudioClientForm
          studioId={dash.studio.id}
          dash={dash}
          onSaved={(next) => {
            setCreating(false);
            onChange(next);
          }}
        />
      )}
      <StudioClientEditDialog
        draft={editing}
        studioId={dash.studio.id}
        dash={dash}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          setEditing(null);
          onChange(next);
        }}
      />
      <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-card">
        {visibleClients.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            {clients.length === 0
              ? "Todavía no hay alumnos."
              : "Ningún alumno coincide con esa búsqueda."}
          </li>
        )}
        {visibleClients.map((person) => {
          const bookings = person.userId
            ? dash.reservations
                .filter((item) => item.clientUserId === person.userId)
                .slice()
                .sort(
                  (a, b) =>
                    a.weekday - b.weekday ||
                    a.slotStart.localeCompare(b.slotStart)
                )
            : [];
          const rowId = person.userId ?? person.code ?? "";
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
                    {person.displayName}
                  </p>
                  <p className="hidden min-w-0 max-w-[14rem] truncate text-sm text-muted-foreground sm:block">
                    {person.email || person.phone || "—"}
                  </p>
                  <p className="hidden min-w-0 max-w-[10rem] truncate text-sm text-muted-foreground lg:block">
                    {person.assignedTeacherName || "Sin profesor"}
                  </p>
                  {person.pending ? (
                    <Badge variant="secondary">Pendiente</Badge>
                  ) : null}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-foreground/8 px-4 pt-3 pb-4">
                  {person.email ? (
                    <p className="text-sm text-muted-foreground">
                      Email: {person.email}
                    </p>
                  ) : null}
                  {person.username ? (
                    <p className="text-sm text-muted-foreground">
                      Usuario: {person.username}
                    </p>
                  ) : null}
                  {person.phone ? (
                    <p className="text-sm text-muted-foreground">
                      Teléfono: {person.phone}
                    </p>
                  ) : null}
                  {person.birthDate ? (
                    <p className="text-sm text-muted-foreground">
                      Nacimiento:{" "}
                      {person.birthDate.split("-").reverse().join("/")}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Actividad: {studioKindsLabel(person.activities)}
                  </p>
                  {person.pending && person.code ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-xl italic tracking-wide">
                        {person.code}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => {
                          void navigator.clipboard.writeText(person.code ?? "");
                          toast.success("Código copiado.");
                        }}
                      >
                        <Copy className="size-4" data-icon="inline-start" />
                        Copiar
                      </Button>
                    </div>
                  ) : null}
                  <ClientTeacherAssign
                    studioId={dash.studio.id}
                    person={person}
                    teachers={dash.people
                      .filter(
                        (item) =>
                          item.role === "teacher" &&
                          item.userId &&
                          (item.active ||
                            item.userId === person.assignedTeacherUserId)
                      )
                      .map((teacher) => ({
                        userId: teacher.userId!,
                        displayName: teacher.displayName,
                      }))}
                    onSaved={onChange}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {person.sessionsPerWeek == null
                        ? "Días que asiste"
                        : person.sessionsPerWeek === 1
                          ? "1 día por semana"
                          : `${person.sessionsPerWeek} días por semana`}
                    </p>
                    {bookings.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {bookings.map((item) => (
                          <li
                            key={`${item.weekday}-${item.slotStart}`}
                            className="text-sm text-muted-foreground"
                          >
                            {weekdayLabel(item.weekday)} {item.slotStart}
                            {item.teacherName ? ` · ${item.teacherName}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {person.pending
                          ? "Todavía no entra al sistema."
                          : "Todavía no tiene días cargados."}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {person.userId ? (
                      person.hasPlan ? (
                        <Link
                          href={`/estudio/alumnos/${encodeURIComponent(person.userId)}?desde=${encodeURIComponent(`/estudio/${dash.studio.id}/alumnos`)}`}
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
                      )
                    ) : null}
                    {person.userId && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-4"
                        onClick={() => {
                          setCreating(false);
                          setEditing(draftFromPerson(person, bookings));
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-10 px-4"
                      onClick={() => void removeClient(person)}
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
    </section>
  );
}

function PersonRow({ person }: { person: StudioPerson }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Badge variant={person.pending ? "secondary" : "outline"}>
        {person.pending ? "Pendiente" : "En el sistema"}
      </Badge>
      {person.pending && person.code && (
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3"
          onClick={() => {
            void navigator.clipboard.writeText(person.code ?? "");
            toast.success("Código copiado.");
          }}
        >
          <Copy className="size-4" data-icon="inline-start" />
          Copiar
        </Button>
      )}
    </div>
  );
}
