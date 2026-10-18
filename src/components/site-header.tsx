"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Brain,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Dumbbell,
  GraduationCap,
  MapPin,
  Menu,
  RefreshCw,
  Sparkles,
  UserRound,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Show, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/components/app-provider";
import { isCoachLed } from "@/lib/coach";
import { clientHomeHref } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const { ready, state, account, logoutDemo } = useAppStore();
  const [open, setOpen] = useState(false);
  const [rearmar, setRearmar] = useState(false);
  const hasPlan = ready && Boolean(state);
  const isPro = account?.role === "professional";
  const isStudio = account?.role === "studio";
  const isStudioClient = account?.role === "client" && account.studioRole === "client";
  const canReconfigure = hasPlan && !isStudioClient && !isCoachLed(state?.profile);
  const isLocalSession = Boolean(
    account?.userId && !account.userId.startsWith("user_")
  );
  const firstName = state?.profile.name.split(" ")[0] || account?.name.split(" ")[0];

  useEffect(() => {
    setOpen(false);
    setRearmar(
      pathname === "/comenzar" &&
        new URLSearchParams(window.location.search).get("modo") === "rearmar"
    );
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/8 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={open}
          aria-controls="menu-lateral"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
        <Link
          href={
            account ? clientHomeHref(account, hasPlan) : "/"
          }
          className="flex items-center gap-2 font-medium tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Dumbbell className="size-4" />
          </span>
          <span className="font-heading text-lg italic">Enforma</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            {isLocalSession ? (
              <>
                {account?.username ? (
                  <span className="max-w-36 truncate text-sm text-muted-foreground">
                    {account.username}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-3"
                  onClick={() => {
                    void logoutDemo().then(() => {
                      window.location.href = "/";
                    });
                  }}
                >
                  Salir
                </Button>
              </>
            ) : null}
          </Show>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/25" />
          <DialogPrimitive.Popup
            id="menu-lateral"
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex h-full w-[min(20rem,88vw)] flex-col bg-background p-4 shadow-xl outline-none ring-1 ring-foreground/10 duration-200",
              "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left-10",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left-10"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="font-heading text-2xl italic">
                  Menú
                </DialogTitle>
                {firstName && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hola, {firstName}
                  </p>
                )}
              </div>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Cerrar menú"
                  />
                }
              >
                <X />
              </DialogClose>
            </div>

            <nav className="mt-6 flex flex-1 flex-col gap-1">
              {!account ? (
                <>
                  <MenuLink
                    href="/entrar-estudio"
                    active={pathname.startsWith("/entrar-estudio")}
                    icon={Building2}
                    onNavigate={() => setOpen(false)}
                  >
                    Estudio
                  </MenuLink>
                  <MenuLink
                    href="/entrar-profesor"
                    active={pathname.startsWith("/entrar-profesor")}
                    icon={GraduationCap}
                    onNavigate={() => setOpen(false)}
                  >
                    Profesor
                  </MenuLink>
                  <MenuLink
                    href="/entrar-usuario"
                    active={pathname.startsWith("/entrar-usuario")}
                    icon={Users}
                    onNavigate={() => setOpen(false)}
                  >
                    Alumno
                  </MenuLink>
                </>
              ) : isStudio ? (
                <>
                  <MenuLink
                    href="/estudio"
                    active={
                      pathname === "/estudio" ||
                      (pathname.startsWith("/estudio/") &&
                        !pathname.startsWith("/estudio/profesores") &&
                        !pathname.startsWith("/estudio/alumnos") &&
                        !pathname.startsWith("/estudio/cuentas") &&
                        !pathname.startsWith("/estudio/estadisticas"))
                    }
                    icon={Building2}
                    onNavigate={() => setOpen(false)}
                  >
                    Estudio
                  </MenuLink>
                  <MenuLink
                    href="/estudio/profesores"
                    active={
                      pathname === "/estudio/profesores" ||
                      pathname.startsWith("/estudio/profesores/")
                    }
                    icon={GraduationCap}
                    onNavigate={() => setOpen(false)}
                  >
                    Profesores
                  </MenuLink>
                  <MenuLink
                    href="/estudio/alumnos"
                    active={
                      pathname === "/estudio/alumnos" ||
                      pathname.startsWith("/estudio/alumnos/")
                    }
                    icon={Users}
                    onNavigate={() => setOpen(false)}
                  >
                    Alumnos
                  </MenuLink>
                  <MenuLink
                    href="/estudio/cuentas"
                    active={
                      pathname === "/estudio/cuentas" ||
                      pathname.startsWith("/estudio/cuentas/")
                    }
                    icon={Wallet}
                    onNavigate={() => setOpen(false)}
                  >
                    Cuentas
                  </MenuLink>
                  <MenuLink
                    href="/estudio/estadisticas"
                    active={
                      pathname === "/estudio/estadisticas" ||
                      pathname.startsWith("/estudio/estadisticas/")
                    }
                    icon={ChartColumn}
                    onNavigate={() => setOpen(false)}
                  >
                    Estadísticas
                  </MenuLink>
                </>
              ) : isPro ? (
                <>
                  <MenuLink
                    href="/profesor"
                    active={pathname === "/profesor"}
                    icon={CalendarDays}
                    onNavigate={() => setOpen(false)}
                  >
                    Agenda
                  </MenuLink>
                  <MenuLink
                    href="/profesor/alumnos"
                    active={
                      pathname === "/profesor/alumnos" ||
                      (pathname.startsWith("/profesor/") &&
                        !pathname.startsWith("/profesor/sucursales") &&
                        pathname !== "/profesor")
                    }
                    icon={GraduationCap}
                    onNavigate={() => setOpen(false)}
                  >
                    Alumnos
                  </MenuLink>
                  <MenuLink
                    href="/profesor/sucursales"
                    active={
                      pathname === "/profesor/sucursales" ||
                      pathname.startsWith("/profesor/sucursales/")
                    }
                    icon={MapPin}
                    onNavigate={() => setOpen(false)}
                  >
                    Sucursales
                  </MenuLink>
                </>
              ) : (
                <>
              {isStudioClient && (
                <>
                <MenuLink
                  href="/panel"
                  active={pathname === "/panel"}
                  icon={CalendarCheck}
                  onNavigate={() => setOpen(false)}
                >
                  Mi plan
                </MenuLink>
                <MenuLink
                  href="/turnos"
                  active={pathname === "/turnos"}
                  icon={CalendarClock}
                  onNavigate={() => setOpen(false)}
                >
                  Agenda
                </MenuLink>
                <MenuLink
                  href="/datos"
                  active={pathname === "/datos"}
                  icon={UserRound}
                  onNavigate={() => setOpen(false)}
                >
                  Datos personales
                </MenuLink>
                </>
              )}
              {!isStudioClient && (
                <>
              <MenuLink
                  href="/unirse"
                  active={pathname === "/unirse"}
                  icon={UserPlus}
                  onNavigate={() => setOpen(false)}
                >
                  Unirme a un gimnasio
                </MenuLink>
              {hasPlan && (
                <MenuLink
                  href="/panel"
                  active={pathname === "/panel"}
                  icon={CalendarCheck}
                  onNavigate={() => setOpen(false)}
                >
                  Mi plan
                </MenuLink>
              )}
              {hasPlan && (
                <MenuLink
                  href="/agenda"
                  active={pathname === "/agenda"}
                  icon={CalendarDays}
                  onNavigate={() => setOpen(false)}
                >
                  Agenda
                </MenuLink>
              )}
              {hasPlan && (
                <MenuLink
                  href="/nutricion"
                  active={pathname === "/nutricion"}
                  icon={UtensilsCrossed}
                  onNavigate={() => setOpen(false)}
                >
                  Nutrición
                </MenuLink>
              )}
              {hasPlan && (
                <MenuLink
                  href="/mente"
                  active={pathname === "/mente"}
                  icon={Brain}
                  onNavigate={() => setOpen(false)}
                >
                  Mente
                </MenuLink>
              )}
              {canReconfigure && (
                <MenuLink
                  href="/comenzar?modo=rearmar"
                  active={rearmar}
                  icon={RefreshCw}
                  onNavigate={() => setOpen(false)}
                >
                  Reconfigurar
                </MenuLink>
              )}
              <MenuLink
                href="/comenzar"
                active={pathname === "/comenzar" && !rearmar}
                icon={Sparkles}
                onNavigate={() => setOpen(false)}
              >
                {hasPlan
                  ? "Nuevo plan de entrenamiento"
                  : "Plan de entrenamiento"}
              </MenuLink>
                </>
              )}
                </>
              )}
            </nav>
          </DialogPrimitive.Popup>
        </DialogPortal>
      </Dialog>
    </header>
  );
}

function MenuLink({
  href,
  active,
  icon: Icon,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  icon: typeof CalendarDays;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </Link>
  );
}
