"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, UserRound } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadTeacherProfile,
  saveTeacherProfile,
  type TeacherProfile,
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

export function TeacherProfileForm() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTeacherProfile()
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
        setPhotoData(row.photoData);
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
      const next = await saveTeacherProfile({
        displayName: name,
        phone,
        email,
        photoData,
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
      setPhotoData(await readPhotoAsDataUrl(file));
    } catch (error) {
      toast.error(errorMessage(error));
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
            El gimnasio tiene que haberte dado de alta como profesor.
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
          Profesor
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
          Tus datos.
        </h1>
        <p className="mt-3 text-muted-foreground">
          {profile.username
            ? `Usuario ${profile.username}. Foto y teléfono de contacto.`
            : "Foto y teléfono de contacto."}
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
            <Label htmlFor="teacher-name">Nombre</Label>
            <Input
              id="teacher-name"
              className="h-11 text-base"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="teacher-email">Email</Label>
            <Input
              id="teacher-email"
              type="email"
              className="h-11 text-base"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="teacher-phone">Teléfono</Label>
            <Input
              id="teacher-phone"
              className="h-11 text-base"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <Button className="h-11 px-5" disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </main>
    </div>
  );
}
