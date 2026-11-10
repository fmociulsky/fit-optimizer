"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEMO_EMAIL =
  process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim() || "hola@enforma.app";

export function DemoRequestButton({
  className,
  children = "Solicitar Demo",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setMessage("");
  }

  function submit() {
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedPhone || !trimmedEmail) {
      toast.error("Completá nombre, teléfono y email.");
      return;
    }

    setBusy(true);
    const body = [
      "Solicitud de demo de Enforma",
      "",
      `Nombre: ${trimmedName}`,
      `Teléfono: ${trimmedPhone}`,
      `Email: ${trimmedEmail}`,
      "",
      message.trim() || "Sin mensaje adicional.",
    ].join("\n");

    const href = `mailto:${encodeURIComponent(DEMO_EMAIL)}?subject=${encodeURIComponent(
      `Demo Enforma — ${trimmedName}`
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = href;
    toast.success("Abrimos tu correo para enviar la solicitud.");
    setBusy(false);
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        nativeButton
        className={cn(
          "inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85",
          className
        )}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl italic">
            Solicitar demo
          </DialogTitle>
          <DialogDescription>
            Dejanos tus datos y te mostramos Enforma en vivo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="demo-name">Nombre</Label>
            <Input
              id="demo-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 text-base"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-phone">Teléfono</Label>
            <Input
              id="demo-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-11 text-base"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-email">Email</Label>
            <Input
              id="demo-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 text-base"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-message">¿Qué necesitás?</Label>
            <textarea
              id="demo-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Contanos libremente lo que necesitás…"
            />
          </div>
          <Button className="h-11 w-full" disabled={busy} type="submit">
            {busy ? "Preparando…" : "Enviar solicitud"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
