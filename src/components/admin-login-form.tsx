"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAdmin } from "@/lib/session";

export function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginAdmin(username, password);
      toast.success("Entraste a administración.");
      window.location.assign("/admin/estudios");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo entrar."
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Administración."
      hint="Acceso interno de Enforma. No forma parte del login de estudio, profesor o alumno."
    >
      <form
        className="mx-auto w-full max-w-sm space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="admin-login">Usuario</Label>
          <Input
            id="admin-login"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 text-base"
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-pass">Contraseña</Label>
          <Input
            id="admin-pass"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 text-base"
            autoComplete="current-password"
          />
        </div>
        {error ? (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button className="h-11 w-full" disabled={busy} type="submit">
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
