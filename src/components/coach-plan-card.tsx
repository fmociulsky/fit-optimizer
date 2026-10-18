"use client";

import { useState } from "react";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COACH_PLAN_REQUEST_TITLE } from "@/lib/coach";
import { formatDate } from "@/lib/metrics";

export function CoachPlanCard({
  requestedAt,
  linkedCode,
  onLink,
  onRequest,
}: {
  requestedAt?: string | null;
  linkedCode?: string | null;
  onLink?: (code: string) => Promise<unknown>;
  onRequest?: () => Promise<void> | void;
}) {
  const requested = Boolean(requestedAt);
  const linked = Boolean(linkedCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runLink() {
    if (!onLink || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLink(code);
      setCode("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo vincular."
      );
    } finally {
      setBusy(false);
    }
  }

  async function runRequest() {
    if (!onRequest || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRequest();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo enviar."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/8 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <GraduationCap className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {requested
              ? "Solicitud enviada"
              : linked
                ? "Tu profesor"
                : "Código de tu profesor"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {requested
              ? `Solicitud enviada${requestedAt ? ` el ${formatDate(requestedAt)}` : ""}. Cuando tu profesor arme el plan de entrenamiento, las sesiones aparecen aquí.`
              : linked
                ? `Vinculado con ${linkedCode}. Tu profesor puede armar el plan de entrenamiento con Enforma o escribirlo a mano.`
                : "Pide el código a tu profesor (empieza por ENF-). Con eso le llega el pedido de plan de entrenamiento."}
          </p>
          {onLink && !linked && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="coach-code">Código del profesor</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="coach-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ENF-AB12CD"
                  className="h-11 text-base tracking-wide sm:max-w-56"
                  autoCapitalize="characters"
                />
                <Button
                  className="h-11 px-4"
                  disabled={busy || !code.trim()}
                  onClick={() => void runLink()}
                >
                  Vincular
                </Button>
              </div>
            </div>
          )}
          {onRequest && linked && (
            <Button
              className="mt-4 h-11 px-4"
              disabled={requested || busy}
              onClick={() => void runRequest()}
            >
              {requested ? (
                <>
                  <CheckCircle2 className="size-4" data-icon="inline-start" />
                  Solicitud enviada
                </>
              ) : (
                COACH_PLAN_REQUEST_TITLE
              )}
            </Button>
          )}
          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
