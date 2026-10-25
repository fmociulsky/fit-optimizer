"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Camera } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadStudioOwnerProfile,
  saveStudioOwnerProfile,
  type StudioOwnerProfile,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

async function readLogoAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elegí una imagen JPG, PNG o WebP.");
  }
  if (file.size > 4_000_000) {
    throw new Error("El logo es demasiado grande (máx. 4 MB).");
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar el logo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function StudioOwnerProfileForm() {
  const [profile, setProfile] = useState<StudioOwnerProfile | null>(null);
  const [gymName, setGymName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [logoData, setLogoData] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
        setLogoData(row.logoData);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogoChange(file: File | null) {
    if (!file) return;
    try {
      setLogoData(await readLogoAsDataUrl(file));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function saveProfile() {
    setBusy(true);
    try {
      const next = await saveStudioOwnerProfile({
        displayName: gymName,
        contactName,
        contactPhone,
        contactEmail,
        logoData,
      });
      if (!next) throw new Error("No se pudo guardar.");
      setProfile(next);
      setLogoData(next.logoData);
      toast.success("Datos guardados.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
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
            ? `Usuario ${profile.username}. Logo, contacto y contraseña.`
            : "Logo, contacto y contraseña."}
        </p>

        <form
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <section className="space-y-4 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Gimnasio</p>
            <div className="flex items-center gap-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-foreground/10 bg-muted">
                {logoData ? (
                  <img
                    src={logoData}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <Building2 className="absolute inset-0 m-auto size-8 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium">Logo</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Camera className="size-4" data-icon="inline-start" />
                    {logoData ? "Cambiar" : "Subir"}
                  </Button>
                  {logoData ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoData("")}
                    >
                      Quitar
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o WebP.
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    void onLogoChange(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
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
      </main>
    </div>
  );
}
