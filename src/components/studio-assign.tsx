"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchesSearch } from "@/lib/search";
import {
  assignStudioClient,
  unassignStudioClient,
  type StudioDashboard,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export type AssignableClient = {
  userId: string | null;
  code?: string;
  displayName: string;
  email?: string;
  assignedTeacherUserId: string | null;
  assignedTeacherName: string | null;
};

export type AssignableTeacher = {
  userId: string;
  displayName: string;
};

function AssignSearchList({
  searchId,
  label,
  placeholder,
  query,
  onQueryChange,
  options,
  pick,
  onPick,
  emptyNone,
  emptySearch,
}: {
  searchId: string;
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: { id: string; name: string; meta?: string }[];
  pick: string;
  onPick: (id: string) => void;
  emptyNone: string;
  emptySearch: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={searchId}>{label}</Label>
        <Input
          id={searchId}
          className="h-11 text-base"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      <ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/8">
        {options.length === 0 ? (
          <li className="px-3 py-2.5 text-sm text-muted-foreground">
            {query.trim() ? emptySearch : emptyNone}
          </li>
        ) : (
          options.map((item) => {
            const on = pick === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                    on ? "bg-primary/8" : "hover:bg-muted/60"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.name}
                  </span>
                  {item.meta ? (
                    <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                      {item.meta}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function confirmTeacherChange(
  name: string,
  currentTeacherId: string | null,
  currentTeacherName: string | null,
  nextTeacherId: string
) {
  if (!currentTeacherId || currentTeacherId === nextTeacherId) return true;
  return window.confirm(
    `¿Asignar a ${name} a otro profesor${currentTeacherName ? ` (ahora ${currentTeacherName})` : ""}? Se borran sus días reservados.`
  );
}

export function TeacherStudentAssign({
  studioId,
  teacherUserId,
  teacherName,
  clients,
  onSaved,
}: {
  studioId: string;
  teacherUserId: string;
  teacherName: string;
  clients: AssignableClient[];
  onSaved: (next: StudioDashboard) => void;
}) {
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = clients.filter(
    (item) => item.assignedTeacherUserId === teacherUserId
  );
  const assignable = useMemo(
    () =>
      clients.filter(
        (item) =>
          item.assignedTeacherUserId !== teacherUserId &&
          matchesSearch(query, item.displayName, item.email ?? "")
      ),
    [clients, query, teacherUserId]
  );

  function optionId(person: AssignableClient) {
    return person.userId || person.code || "";
  }

  async function assign() {
    const person = clients.find((item) => optionId(item) === pick);
    if (!person || busy) return;
    if (
      !confirmTeacherChange(
        person.displayName,
        person.assignedTeacherUserId,
        person.assignedTeacherName,
        teacherUserId
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      onSaved(
        await assignStudioClient({
          studioId,
          clientUserId: person.userId,
          inviteCode: person.code,
          teacherUserId,
        })
      );
      setPick("");
      setQuery("");
      toast.success(`${person.displayName} quedó con ${teacherName}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function unassign(person: AssignableClient) {
    if (busy) return;
    const ok = window.confirm(
      `¿Quitar a ${person.displayName} de ${teacherName}? Se borran sus días reservados.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      onSaved(
        await unassignStudioClient({
          studioId,
          clientUserId: person.userId,
          inviteCode: person.code,
        })
      );
      toast.success("Alumno desasignado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-muted-foreground">Alumnos de este profesor</p>
      <ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/8">
        {mine.length === 0 ? (
          <li className="px-3 py-2.5 text-sm text-muted-foreground">
            Todavía no tiene alumnos asignados.
          </li>
        ) : (
          mine.map((person) => (
            <li
              key={optionId(person)}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {person.displayName}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 px-3"
                disabled={busy}
                onClick={() => void unassign(person)}
              >
                Quitar
              </Button>
            </li>
          ))
        )}
      </ul>
      <div className="rounded-xl border border-foreground/8 p-3">
        <p className="font-medium">Asignar un alumno a {teacherName}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Buscá por nombre entre los de esta sucursal que todavía no están con
          este profesor.
        </p>
        {clients.length === mine.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay más alumnos en esta sucursal para asignar.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <AssignSearchList
              searchId={`assign-student-${teacherUserId}`}
              label="Nombre"
              placeholder="Escribí el nombre"
              query={query}
              onQueryChange={(next) => {
                setQuery(next);
                setPick("");
              }}
              options={assignable.map((item) => ({
                id: optionId(item),
                name: item.displayName,
                meta: item.assignedTeacherName || "Sin profesor",
              }))}
              pick={pick}
              onPick={setPick}
              emptyNone="No hay alumnos para asignar."
              emptySearch="Ningún alumno coincide con esa búsqueda."
            />
            <Button
              className="h-11 px-5"
              disabled={busy || !pick}
              onClick={() => void assign()}
            >
              {busy ? "Asignando…" : "Asignar"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientTeacherAssign({
  studioId,
  person,
  teachers,
  onSaved,
}: {
  studioId: string;
  person: AssignableClient;
  teachers: AssignableTeacher[];
  onSaved: (next: StudioDashboard) => void;
}) {
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const options = useMemo(
    () =>
      teachers.filter(
        (item) =>
          item.userId !== person.assignedTeacherUserId &&
          matchesSearch(query, item.displayName)
      ),
    [teachers, query, person.assignedTeacherUserId]
  );

  async function assign() {
    const teacher = teachers.find((item) => item.userId === pick);
    if (!teacher || busy) return;
    if (
      !confirmTeacherChange(
        person.displayName,
        person.assignedTeacherUserId,
        person.assignedTeacherName,
        teacher.userId
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      onSaved(
        await assignStudioClient({
          studioId,
          clientUserId: person.userId,
          inviteCode: person.code,
          teacherUserId: teacher.userId,
        })
      );
      setPick("");
      setQuery("");
      toast.success(`Profesor asignado: ${teacher.displayName}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    if (busy || !person.assignedTeacherUserId) return;
    const ok = window.confirm(
      `¿Quitar el profesor de ${person.displayName}? Se borran sus días reservados.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      onSaved(
        await unassignStudioClient({
          studioId,
          clientUserId: person.userId,
          inviteCode: person.code,
        })
      );
      toast.success("Profesor desasignado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Asigná un profesor a esta sucursal para poder vincularlo a este alumno.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {person.assignedTeacherName
          ? `Profesor: ${person.assignedTeacherName}`
          : "Sin profesor"}
      </p>
      <div className="rounded-xl border border-foreground/8 p-3">
        <p className="font-medium">
          {person.assignedTeacherName
            ? `Cambiar profesor de ${person.displayName}`
            : `Asignar profesor a ${person.displayName}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Buscá por nombre entre los profesores de esta sucursal.
        </p>
        {options.length === 0 && !query.trim() ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay otros profesores en esta sucursal.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <AssignSearchList
              searchId={`assign-teacher-${person.userId ?? person.code ?? "client"}`}
              label="Nombre"
              placeholder="Escribí el nombre"
              query={query}
              onQueryChange={(next) => {
                setQuery(next);
                setPick("");
              }}
              options={options.map((item) => ({
                id: item.userId,
                name: item.displayName,
              }))}
              pick={pick}
              onPick={setPick}
              emptyNone="No hay profesores para asignar."
              emptySearch="Ningún profesor coincide con esa búsqueda."
            />
            <Button
              className="h-11 px-5"
              disabled={busy || !pick}
              onClick={() => void assign()}
            >
              {busy ? "Asignando…" : "Asignar"}
            </Button>
          </div>
        )}
      </div>
      {person.assignedTeacherUserId ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 px-4"
          disabled={busy}
          onClick={() => void unassign()}
        >
          Quitar profesor
        </Button>
      ) : null}
    </div>
  );
}
