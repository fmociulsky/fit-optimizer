"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DefaultAttendancePicker } from "@/components/default-attendance-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLIENT_BILLING_PLAN_LABEL,
  CLIENT_BILLING_PLANS,
  serviceEndsFromStart,
  todayBillingYmd,
} from "@/lib/client-account";
import { studioKindsLabel } from "@/lib/labels";
import {
  createStudioClient,
  updateStudioClient,
  type StudioDashboard,
} from "@/lib/studio";
import type { ClientBillingPlan, StudioKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export type StudioClientDraft = {
  userId: string;
  displayName: string;
  phone: string;
  email: string;
  birthDate: string;
  activities: StudioKind[];
  sessionsPerWeek: number | null;
  assignedTeacherUserId: string | null;
  picks: { weekday: number; slotStart: string }[];
};

export function StudioClientEditDialog({
  draft,
  studioId,
  dash,
  onClose,
  onSaved,
}: {
  draft: StudioClientDraft | null;
  studioId: string;
  dash: StudioDashboard | null;
  onClose: () => void;
  onSaved: (next: StudioDashboard) => void;
}) {
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[min(90svh,44rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl italic">
            {draft?.displayName.trim() || "Editar alumno"}
          </DialogTitle>
          <DialogDescription>
            Revisá los datos. Guardá para actualizar la lista, o cerrá sin
            cambiar nada.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <StudioClientForm
            key={draft.userId}
            studioId={studioId}
            dash={dash}
            initial={draft}
            showHeading={false}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function StudioClientForm({
  studioId,
  dash,
  initial,
  showHeading = true,
  onCancel,
  onSaved,
}: {
  studioId: string;
  dash: StudioDashboard | null;
  initial?: StudioClientDraft;
  showHeading?: boolean;
  onCancel?: () => void;
  onSaved: (next: StudioDashboard) => void;
}) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.displayName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [activities, setActivities] = useState<StudioKind[]>(
    initial?.activities ?? []
  );
  const [sessions, setSessions] = useState(
    String(initial?.sessionsPerWeek || 2)
  );
  const [teacherId, setTeacherId] = useState(
    initial?.assignedTeacherUserId ?? ""
  );
  const [picks, setPicks] = useState<{ weekday: number; slotStart: string }[]>(
    initial?.picks ?? []
  );
  const [billingPlan, setBillingPlan] = useState<ClientBillingPlan | null>(
    null
  );
  const [feeAmount, setFeeAmount] = useState("");
  const [serviceStartsOn, setServiceStartsOn] = useState(todayBillingYmd());
  const [busy, setBusy] = useState(false);
  const teachers =
    dash?.people.filter(
      (item) =>
        item.role === "teacher" &&
        item.userId &&
        (item.active ||
          item.userId === teacherId ||
          item.userId === initial?.assignedTeacherUserId)
    ) ?? [];
  const studioKinds = dash?.studio.kinds ?? [];
  const chosenTeacher = teacherId || teachers[0]?.userId || "";
  const allowed = Number(sessions);
  const serviceEndsOn = useMemo(() => {
    if (editing || !billingPlan || !serviceStartsOn) return "";
    try {
      return serviceEndsFromStart(serviceStartsOn, billingPlan);
    } catch {
      return "";
    }
  }, [editing, billingPlan, serviceStartsOn]);

  useEffect(() => {
    if (initial) return;
    const kinds = dash?.studio.kinds ?? [];
    if (kinds.length === 1) setActivities(kinds);
  }, [dash?.studio.id, dash?.studio.kinds, initial]);

  function setTeacher(next: string) {
    setTeacherId(next);
  }

  function setSessionCount(next: string) {
    const n = Number(next);
    setSessions(next);
    setPicks((current) => current.slice(0, n));
  }

  async function save() {
    if (!studioId) {
      toast.error("Elegí una sucursal.");
      return;
    }
    let parsedFee = 0;
    if (!initial) {
      if (!billingPlan) {
        toast.error("Elegí el plan: mensual, trimestral o anual.");
        return;
      }
      parsedFee = Number.parseInt(feeAmount.replace(/\D/g, ""), 10);
      if (!Number.isFinite(parsedFee) || parsedFee <= 0) {
        toast.error("Pon el valor del plan.");
        return;
      }
      if (!serviceStartsOn) {
        toast.error("Pon el día de inicio del plan.");
        return;
      }
    }
    setBusy(true);
    try {
      const payload = {
        studioId,
        displayName: name,
        phone,
        email,
        birthDate,
        activities,
        sessionsPerWeek: allowed,
        teacherUserId: chosenTeacher,
        picks,
      };
      const next = initial
        ? await updateStudioClient({
            ...payload,
            clientUserId: initial.userId,
          })
        : await createStudioClient({
            ...payload,
            billingPlan: billingPlan!,
            serviceStartsOn,
            feeAmount: parsedFee,
          });
      onSaved(next);
      if (!initial) {
        setName("");
        setPhone("");
        setEmail("");
        setBirthDate("");
        setActivities(studioKinds.length === 1 ? studioKinds : []);
        setPicks([]);
        setBillingPlan(null);
        setFeeAmount("");
        setServiceStartsOn(todayBillingYmd());
      }
      toast.success(initial ? "Alumno actualizado." : "Alumno creado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={showHeading ? "rounded-3xl border border-foreground/8 bg-card p-5" : ""}>
      {showHeading ? (
        <>
          <p className="font-medium">{editing ? "Editar alumno" : "Nuevo alumno"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Datos personales, plan de pago, actividad, cuántos días va y los
            horarios por defecto dentro de la apertura de la sucursal.
          </p>
        </>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="client-name">Nombre</Label>
          <Input
            id="client-name"
            className="h-11 text-base"
            placeholder="Nombre y apellido"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-email">Email</Label>
          <Input
            id="client-email"
            type="email"
            className="h-11 text-base"
            placeholder="email@correo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-phone">Teléfono</Label>
          <Input
            id="client-phone"
            className="h-11 text-base"
            placeholder="Teléfono"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-birth">Fecha de nacimiento</Label>
          <Input
            id="client-birth"
            type="date"
            className="h-11 text-base"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Actividad</Label>
          {studioKinds.length <= 1 ? (
            <p className="text-sm text-muted-foreground">
              {studioKindsLabel(studioKinds.length ? studioKinds : ["gym"])}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["gym", "Gimnasio", ["gym"]],
                  ["pilates", "Pilates", ["pilates"]],
                  ["both", "Ambos", ["gym", "pilates"]],
                ] as const
              ).map(([id, label, kinds]) => {
                const selected =
                  kinds.length === 2
                    ? activities.includes("gym") && activities.includes("pilates")
                    : activities.length === 1 && activities[0] === kinds[0];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActivities([...kinds])}
                    className={cn(
                      "h-11 rounded-xl border text-sm font-medium",
                      selected
                        ? "border-primary bg-primary/8 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-teacher">Profesor</Label>
          <select
            id="client-teacher"
            className={fieldClass}
            value={chosenTeacher}
            onChange={(event) => setTeacher(event.target.value)}
            disabled={teachers.length === 0}
          >
            {teachers.length === 0 && <option value="">Sin profesor</option>}
            {teachers.map((teacher) => (
              <option key={teacher.userId} value={teacher.userId ?? ""}>
                {teacher.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-sessions">Días por semana</Label>
          <select
            id="client-sessions"
            className={fieldClass}
            value={sessions}
            onChange={(event) => setSessionCount(event.target.value)}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 día" : `${n} días`}
              </option>
            ))}
          </select>
        </div>
        {!editing ? (
          <>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Plan</Label>
              <div className="grid grid-cols-3 gap-2">
                {CLIENT_BILLING_PLANS.map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setBillingPlan(plan)}
                    className={cn(
                      "h-11 rounded-xl border text-sm font-medium",
                      billingPlan === plan
                        ? "border-primary bg-primary/8 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {CLIENT_BILLING_PLAN_LABEL[plan]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-fee">Valor del plan (ARS)</Label>
              <Input
                id="client-fee"
                className="h-11 text-base"
                inputMode="numeric"
                placeholder="45000"
                value={feeAmount}
                onChange={(event) => setFeeAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-start">Día de inicio</Label>
              <Input
                id="client-start"
                type="date"
                className="h-11 text-base"
                value={serviceStartsOn}
                onChange={(event) => setServiceStartsOn(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Próximo vencimiento</Label>
              <p className="flex h-11 items-center rounded-lg border border-dashed border-border px-2.5 text-sm text-muted-foreground">
                {serviceEndsOn
                  ? new Intl.DateTimeFormat("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(`${serviceEndsOn}T12:00:00`))
                  : "Elegí plan e inicio"}
              </p>
            </div>
          </>
        ) : null}
      </div>
      {teachers.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Primero asigná un profesor a esta sucursal.
        </p>
      ) : dash ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Horarios por defecto</p>
          <DefaultAttendancePicker
            occupancy={dash.occupancy}
            allowed={allowed}
            activities={activities.length ? activities : studioKinds}
            value={picks}
            committed={initial?.picks ?? []}
            onChange={setPicks}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Cargando horarios de la sucursal…
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="h-11 px-5"
          disabled={busy || teachers.length === 0 || !studioId}
          onClick={() => void save()}
        >
          {busy
            ? editing
              ? "Guardando…"
              : "Creando…"
            : editing
              ? "Guardar"
              : "Crear alumno"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 px-5"
            disabled={busy}
            onClick={onCancel}
          >
            Cerrar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
