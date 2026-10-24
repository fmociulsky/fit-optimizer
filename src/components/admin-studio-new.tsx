"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BackLink } from "@/components/back-link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_HINT } from "@/lib/password-rules";
import { createContractedStudio } from "@/lib/admin";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function todayYmd() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultEndsOn() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function AdminStudioNewView() {
  const router = useRouter();
  const [gymName, setGymName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [serviceStartsOn, setServiceStartsOn] = useState(todayYmd);
  const [serviceEndsOn, setServiceEndsOn] = useState(defaultEndsOn);
  const [serviceFee, setServiceFee] = useState("");
  const [maxBranches, setMaxBranches] = useState("1");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function createStudio() {
    setBusy(true);
    try {
      const created = await createContractedStudio({
        gymName,
        username,
        password,
        email,
        serviceStartsOn,
        serviceEndsOn,
        serviceFeeAmount: serviceFee,
        maxBranches,
        contactName,
        contactPhone,
        contactEmail,
      });
      toast.success("Gimnasio dado de alta.");
      if (created?.userId) {
        router.replace(`/admin/estudios/${encodeURIComponent(created.userId)}`);
      } else {
        router.replace("/admin/estudios");
      }
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <BackLink href="/admin/estudios">Volver a estudios</BackLink>
        <p className="mt-4 text-sm font-medium tracking-wide text-primary uppercase">
          Administración
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
          Nuevo estudio.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Acceso al panel, contrato y datos del contacto responsable.
        </p>

        <form
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void createStudio();
          }}
        >
          <section className="space-y-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Gimnasio y acceso</p>
            <p className="text-sm text-muted-foreground">{PASSWORD_HINT}</p>
            <div className="space-y-1.5">
              <Label htmlFor="new-gym-name">Nombre del gimnasio</Label>
              <Input
                id="new-gym-name"
                className="h-11 text-base"
                value={gymName}
                onChange={(event) => setGymName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-gym-user">Usuario de acceso</Label>
                <Input
                  id="new-gym-user"
                  className="h-11 text-base"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-gym-pass">Contraseña inicial</Label>
                <Input
                  id="new-gym-pass"
                  type="password"
                  className="h-11 text-base"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-gym-email">Email de acceso (opcional)</Label>
              <Input
                id="new-gym-email"
                type="email"
                className="h-11 text-base"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Contrato</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-gym-starts">Inicio</Label>
                <Input
                  id="new-gym-starts"
                  type="date"
                  className="h-11 text-base"
                  value={serviceStartsOn}
                  onChange={(event) => setServiceStartsOn(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-gym-ends">Vence el</Label>
                <Input
                  id="new-gym-ends"
                  type="date"
                  className="h-11 text-base"
                  value={serviceEndsOn}
                  onChange={(event) => setServiceEndsOn(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-gym-fee">Valor del servicio (ARS)</Label>
                <Input
                  id="new-gym-fee"
                  type="number"
                  min={1}
                  step={1}
                  className="h-11 text-base"
                  value={serviceFee}
                  onChange={(event) => setServiceFee(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-gym-branches">Sucursales permitidas</Label>
                <Input
                  id="new-gym-branches"
                  type="number"
                  min={1}
                  step={1}
                  className="h-11 text-base"
                  value={maxBranches}
                  onChange={(event) => setMaxBranches(event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="font-medium">Contacto del estudio</p>
            <p className="text-sm text-muted-foreground">
              Persona responsable con quien hablar por el contrato.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-contact-name">Nombre</Label>
              <Input
                id="new-contact-name"
                className="h-11 text-base"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-contact-phone">Teléfono</Label>
                <Input
                  id="new-contact-phone"
                  className="h-11 text-base"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-contact-email">Email</Label>
                <Input
                  id="new-contact-email"
                  type="email"
                  className="h-11 text-base"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
            </div>
          </section>

          <Button className="h-11 px-5" disabled={busy} type="submit">
            {busy ? "Creando…" : "Dar de alta"}
          </Button>
        </form>
      </main>
    </div>
  );
}
