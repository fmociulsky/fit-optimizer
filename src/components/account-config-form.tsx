"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_HINT, passwordClientError } from "@/lib/password-rules";
import {
  changeClientPassword,
  changeStudioPassword,
  changeTeacherPassword,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export function AccountConfigForm({
  role,
  title = "Configuración.",
  subtitle = "Contraseña de acceso a tu cuenta.",
}: {
  role: "studio" | "teacher" | "client";
  title?: string;
  subtitle?: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function savePassword() {
    const passwordError = passwordClientError(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const payload = { currentPassword, newPassword };
      if (role === "studio") await changeStudioPassword(payload);
      else if (role === "teacher") await changeTeacherPassword(payload);
      else await changeClientPassword(payload);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const eyebrow =
    role === "studio" ? "Gimnasio" : role === "teacher" ? "Profesor" : "Alumno";

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
          {title}
        </h1>
        <p className="mt-3 text-muted-foreground">{subtitle}</p>

        <section className="mt-8 space-y-4 rounded-2xl border border-foreground/8 bg-card p-4">
          <div>
            <p className="font-medium">Cambiar contraseña</p>
            <p className="mt-1 text-sm text-muted-foreground">{PASSWORD_HINT}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="config-current-password">Contraseña actual</Label>
            <Input
              id="config-current-password"
              type="password"
              className="h-11 text-base"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="config-new-password">Nueva contraseña</Label>
            <Input
              id="config-new-password"
              type="password"
              className="h-11 text-base"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="config-confirm-password">
              Repetir nueva contraseña
            </Label>
            <Input
              id="config-confirm-password"
              type="password"
              className="h-11 text-base"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button
            type="button"
            className="h-11 px-5"
            disabled={
              busy || !currentPassword || !newPassword || !confirmPassword
            }
            onClick={() => void savePassword()}
          >
            {busy ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </section>
      </main>
    </div>
  );
}
