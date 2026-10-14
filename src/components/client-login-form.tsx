"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginDemoClient } from "@/lib/session";
import {
  claimStudentFromClerk,
  requestStudentFirstAccess,
} from "@/lib/student-auth";
import { cn } from "@/lib/utils";

function clerkMessage(error: { message?: string; longMessage?: string } | null) {
  return error?.longMessage || error?.message || "No se pudo entrar.";
}

export function ClientLoginForm({ denied = false }: { denied?: boolean }) {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstAccess, setFirstAccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    denied
      ? "No hay un alumno con ese email. Pedile al gimnasio que te dé de alta."
      : null
  );

  const waiting = busy || fetchStatus === "fetching";

  async function google() {
    if (waiting || !signIn) return;
    setBusy(true);
    setError(null);
    const { error: ssoError } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/entrar-usuario/vincular",
      redirectCallbackUrl: "/entrar-usuario/sso",
    });
    if (ssoError) {
      setError(clerkMessage(ssoError));
      setBusy(false);
    }
  }

  async function finishClerkSession() {
    const claimed = await claimStudentFromClerk();
    if (!claimed.ok) {
      throw new Error(
        claimed.reason === "vinculado"
          ? "Ese alumno ya está vinculado a otra cuenta."
          : "No hay un alumno con ese email. Pedile al gimnasio que te dé de alta."
      );
    }
    window.location.assign("/panel");
  }

  async function submit() {
    if (waiting) return;
    setBusy(true);
    setError(null);
    try {
      if (firstAccess) {
        await requestStudentFirstAccess(email);
        toast.success("Te enviamos un email para setear tu contraseña.");
        setBusy(false);
        return;
      }
      const account = await loginDemoClient(email, password);
      if (account) {
        toast.success(
          account.userId === "demo-client"
            ? "Entraste como alumno de prueba."
            : "Entraste."
        );
        window.location.assign("/panel");
        return;
      }
      if (!signIn) throw new Error("No se pudo entrar.");
      const { error: passwordError } = await signIn.password({
        identifier: email.trim().toLowerCase(),
        password,
      });
      if (passwordError) {
        throw new Error(clerkMessage(passwordError));
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: async ({ decorateUrl }) => {
            const url = decorateUrl("/entrar-usuario/vincular");
            if (url.startsWith("http")) {
              window.location.href = url;
            } else {
              await finishClerkSession();
            }
          },
        });
        return;
      }
      throw new Error("No se pudo entrar. Si es tu primer ingreso, tildá esa opción.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo entrar.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Entrar como alumno."
      hint="Si tu mail es de Gmail, usá Google. Si no, poné tu email. El gimnasio tiene que haberte dado de alta."
    >
      <form
        className="mx-auto w-full max-w-sm space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={waiting}
          onClick={() => void google()}
        >
          Continuar con Google
        </Button>
        <p className="text-center text-xs tracking-wide text-muted-foreground uppercase">
          o con tu email
        </p>
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="text"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 text-base"
            autoComplete="email"
            placeholder="tu@email.com"
          />
        </div>
        {!firstAccess && (
          <div className="space-y-2">
            <Label htmlFor="user-pass">Contraseña</Label>
            <Input
              id="user-pass"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 text-base"
              autoComplete="current-password"
            />
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-foreground/8 bg-card px-4 py-3">
          <Checkbox
            checked={firstAccess}
            onCheckedChange={(value) => setFirstAccess(Boolean(value))}
          />
          <span className="text-sm">Primer ingreso</span>
        </label>
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button className="h-11 w-full" disabled={waiting} type="submit">
          {waiting
            ? "Esperá…"
            : firstAccess
              ? "Enviar email"
              : "Entrar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Los alumnos del gimnasio entran con su email y contraseña 1234.
          Para el alumno de prueba: 1111 y 1111.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full")}
        >
          Volver
        </Link>
      </form>
    </AuthShell>
  );
}
