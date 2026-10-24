"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_HINT, passwordClientError } from "@/lib/password-rules";
import {
  changeStudioPassword,
  loadStudioOwnerProfile,
  saveStudioOwnerProfile,
  type StudioOwnerProfile,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export function StudioOwnerProfileForm() {
  const [profile, setProfile] = useState<StudioOwnerProfile | null>(null);
  const [gymName, setGymName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadStudioOwnerProfile()
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setMissing(true);
          return;
        }
        setProfile(row);
        setGymName(row.displayName);
        setContactName(row.contactName);
        setContactPhone(row.contactPhone);
        setContactEmail(row.contactEmail);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setBusy(true);
    try {
      const next = await saveStudioOwnerProfile({
        displayName: gymName,
        contactName,
        contactPhone,
        contactEmail,
      });
      if (!next) throw new Error("No se pudo guardar.");
      setProfile(next);
      toast.success("Datos guardados.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

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
    setPasswordBusy(true);
    try {
      await changeStudioPassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPasswordBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-10">
          <h1 className="font-heading text-4xl tracking-tight italic">
            Sin cuenta.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Entrá con la cuenta del gimnasio para gestionar estos datos.
          </p>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando datos…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Gimnasio
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
          Datos de la cuenta.
        </h1>
        <p className="mt-3 text-muted-foreground">
          {profile.username
            ? `Usuario ${profile.username}. Actualizá el contacto del estudio y la contraseña.`
            : "Actualizá el contacto del estudio y la contraseña."}
        </p>

        <form
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <section className="space-y-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Gimnasio</p>
            <div className="space-y-1.5">
              <Label htmlFor="studio-gym-name">Nombre del gimnasio</Label>
              <Input
                id="studio-gym-name"
                className="h-11 text-base"
                value={gymName}
                onChange={(event) => setGymName(event.target.value)}
              />
            </div>
            {profile.username ? (
              <p className="text-sm text-muted-foreground">
                Usuario de acceso: {profile.username}
              </p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Contacto del estudio</p>
            <p className="text-sm text-muted-foreground">
              Persona responsable con quien hablar por el contrato.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="studio-contact-name">Nombre</Label>
              <Input
                id="studio-contact-name"
                className="h-11 text-base"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="studio-contact-phone">Teléfono</Label>
                <Input
                  id="studio-contact-phone"
                  className="h-11 text-base"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="studio-contact-email">Email</Label>
                <Input
                  id="studio-contact-email"
                  type="email"
                  className="h-11 text-base"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
            </div>
          </section>

          <Button className="h-11 px-5" disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>

        <section className="mt-8 space-y-4 rounded-2xl border border-foreground/8 bg-card p-4">
          <div>
            <p className="font-medium">Cambiar contraseña</p>
            <p className="mt-1 text-sm text-muted-foreground">{PASSWORD_HINT}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio-current-password">Contraseña actual</Label>
            <Input
              id="studio-current-password"
              type="password"
              className="h-11 text-base"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio-new-password">Nueva contraseña</Label>
            <Input
              id="studio-new-password"
              type="password"
              className="h-11 text-base"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio-confirm-password">
              Repetir nueva contraseña
            </Label>
            <Input
              id="studio-confirm-password"
              type="password"
              className="h-11 text-base"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 px-5"
            disabled={
              passwordBusy ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            onClick={() => void savePassword()}
          >
            {passwordBusy ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </section>
      </main>
    </div>
  );
}
