"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { studioKindsLabel } from "@/lib/labels";
import {
  loadClientProfile,
  saveClientProfile,
  type ClientProfile,
} from "@/lib/studio";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export function ClientProfileForm() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

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
          <Button className="h-11 px-5" disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </main>
    </div>
  );
}
