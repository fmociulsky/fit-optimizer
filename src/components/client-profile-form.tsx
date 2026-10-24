"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, UserRound } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { studioKindsLabel } from "@/lib/labels";
import { PASSWORD_HINT, passwordClientError } from "@/lib/password-rules";
import {
  changeClientPassword,
  loadClientProfile,
  saveClientProfile,
  type ClientProfile,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

async function readPhotoAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elegí una imagen JPG, PNG o WebP.");
  }
  if (file.size > 4_000_000) {
    throw new Error("La foto es demasiado grande (máx. 4 MB).");
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la foto.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function ClientProfileForm() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadClientProfile()
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setMissing(true);
          return;
        }
        setProfile(row);
        setName(row.displayName);
        setPhone(row.phone);
        setEmail(row.email);
        setBirthDate(row.birthDate);
        setPhotoData(row.photoData);
        setEmergencyName(row.emergencyName);
        setEmergencyPhone(row.emergencyPhone);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setBusy(true);
    try {
      const next = await saveClientProfile({
        displayName: name,
        phone,
        email,
        birthDate,
        photoData,
        emergencyName,
        emergencyPhone,
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

  async function onPhotoChange(file: File | null) {
    if (!file) return;
    try {
      const next = await readPhotoAsDataUrl(file);
      setPhotoData(next);
    } catch (error) {
      toast.error(errorMessage(error));
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
      await changeClientPassword({
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
            Sin ficha.
          </h1>
          <p className="mt-3 text-muted-foreground">
            El gimnasio tiene que haberte dado de alta como alumno.
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
          {profile.studioName}
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
          Datos personales.
        </h1>
        <p className="mt-3 text-muted-foreground">
          {studioKindsLabel(profile.activities)}
          {profile.username ? ` · Usuario ${profile.username}` : ""}
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-foreground/10 bg-muted">
              {photoData ? (
                <img
                  src={photoData}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <UserRound className="absolute inset-0 m-auto size-8 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium">Foto</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="size-4" data-icon="inline-start" />
                  {photoData ? "Cambiar" : "Subir"}
                </Button>
                {photoData ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhotoData("")}
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  void onPhotoChange(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Nombre</Label>
            <Input
              id="profile-name"
              className="h-11 text-base"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              className="h-11 text-base"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Teléfono</Label>
            <Input
              id="profile-phone"
              className="h-11 text-base"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-birth">Fecha de nacimiento</Label>
            <Input
              id="profile-birth"
              type="date"
              className="h-11 text-base"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-foreground/8 bg-card p-4 space-y-4">
            <div>
              <p className="font-medium">Contacto de emergencia</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quién avisar si pasa algo en el gimnasio.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-emergency-name">Nombre</Label>
              <Input
                id="profile-emergency-name"
                className="h-11 text-base"
                value={emergencyName}
                onChange={(event) => setEmergencyName(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-emergency-phone">Teléfono</Label>
              <Input
                id="profile-emergency-phone"
                className="h-11 text-base"
                value={emergencyPhone}
                onChange={(event) => setEmergencyPhone(event.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <Button className="h-11 px-5" disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </form>

        <section className="mt-10 space-y-4 rounded-2xl border border-foreground/8 bg-card p-4">
          <div>
            <p className="font-medium">Cambiar contraseña</p>
            <p className="mt-1 text-sm text-muted-foreground">{PASSWORD_HINT}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-current-password">Contraseña actual</Label>
            <Input
              id="profile-current-password"
              type="password"
              className="h-11 text-base"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-new-password">Nueva contraseña</Label>
            <Input
              id="profile-new-password"
              type="password"
              className="h-11 text-base"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-confirm-password">
              Repetir nueva contraseña
            </Label>
            <Input
              id="profile-confirm-password"
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
