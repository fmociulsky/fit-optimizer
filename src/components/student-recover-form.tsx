"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_HINT, passwordClientError } from "@/lib/password-rules";
import {
  claimStudentFromClerk,
  syncStudentPasswordFromClerk,
} from "@/lib/student-auth";
import { cn } from "@/lib/utils";

function clerkMessage(error: { message?: string; longMessage?: string } | null) {
  return error?.longMessage || error?.message || "No se pudo continuar.";
}

export function StudentRecoverForm() {
  const searchParams = useSearchParams();
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState(
    () => searchParams.get("email")?.trim().toLowerCase() || ""
  );
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"code" | "password">("code");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const waiting = busy || fetchStatus === "fetching";

  async function sendCode(nextEmail = email) {
    if (!signIn) return;
    const identifier = nextEmail.trim().toLowerCase();
    if (!identifier) {
      setError("Pon el email del alumno.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: createError } = await signIn.create({ identifier });
      if (createError) throw new Error(clerkMessage(createError));
      const { error: sendError } =
        await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) throw new Error(clerkMessage(sendError));
      setEmail(identifier);
      setSent(true);
      toast.success("Te enviamos un código al email.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo enviar el código."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!signIn || started.current || !email) return;
    started.current = true;
    void sendCode(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once when Clerk is ready
  }, [signIn]);

  async function verifyCode() {
    if (waiting || !signIn) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } =
        await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (verifyError) throw new Error(clerkMessage(verifyError));
      setStep("password");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo verificar."
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    if (waiting || !signIn) return;
    const passwordError = passwordClientError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: passwordError } =
        await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });
      if (passwordError) throw new Error(clerkMessage(passwordError));
      if (signIn.status !== "complete") {
        throw new Error("No se pudo restablecer la contraseña.");
      }
      await signIn.finalize({
        navigate: async ({ decorateUrl }) => {
          const url = decorateUrl("/entrar-usuario/vincular");
          if (url.startsWith("http")) {
            window.location.href = url;
            return;
          }
          const claimed = await claimStudentFromClerk();
          if (!claimed.ok) {
            window.location.replace("/entrar-usuario?error=no-alumno");
            return;
          }
          try {
            await syncStudentPasswordFromClerk(password);
          } catch {
            // Entró igual.
          }
          toast.success("Contraseña actualizada.");
          window.location.assign("/panel");
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar."
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar contraseña."
      hint={`Te enviamos un código al email del alumno. Después elegís la contraseña nueva. ${PASSWORD_HINT}`}
    >
      <form
        className="mx-auto w-full max-w-sm space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void (step === "code" ? verifyCode() : submitPassword());
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="recover-email">Email</Label>
          <Input
            id="recover-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 text-base"
            autoComplete="email"
            disabled={step === "password"}
          />
        </div>
        {step === "code" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="recover-code">Código</Label>
              <Input
                id="recover-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-11 text-base"
                autoComplete="one-time-code"
                placeholder="Código del email"
              />
            </div>
            <Button className="h-11 w-full" disabled={waiting} type="submit">
              {waiting ? "Esperá…" : "Verificar código"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={waiting}
              onClick={() => void sendCode()}
            >
              {sent ? "Reenviar código" : "Enviar código"}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="recover-pass">Contraseña nueva</Label>
              <Input
                id="recover-pass"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 text-base"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recover-pass-2">Repetir contraseña</Label>
              <Input
                id="recover-pass-2"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="h-11 text-base"
                autoComplete="new-password"
              />
            </div>
            <Button className="h-11 w-full" disabled={waiting} type="submit">
              {waiting ? "Guardando…" : "Guardar y entrar"}
            </Button>
          </>
        )}
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Link
          href="/entrar-usuario"
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full")}
        >
          Volver
        </Link>
      </form>
    </AuthShell>
  );
}
