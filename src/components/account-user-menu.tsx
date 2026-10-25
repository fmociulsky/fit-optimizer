"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useAppStore } from "@/components/app-provider";
import {
  loadAccountMenuProfile,
  type AccountMenuProfile,
} from "@/lib/account-menu";
import { cn } from "@/lib/utils";

function fallbackProfile(
  account: NonNullable<ReturnType<typeof useAppStore>["account"]>
): AccountMenuProfile {
  const label =
    account.username?.trim() ||
    account.name.trim().split(" ")[0] ||
    "Cuenta";
  if (account.role === "studio") {
    return {
      label,
      avatarUrl: "",
      datosHref: "/estudio/datos",
      configHref: "/estudio/configuracion",
      logoutTo: "/",
    };
  }
  if (account.role === "professional") {
    return {
      label,
      avatarUrl: "",
      datosHref: "/profesor/datos",
      configHref: "/profesor/configuracion",
      logoutTo: "/",
    };
  }
  return {
    label,
    avatarUrl: "",
    datosHref: "/datos",
    configHref: "/configuracion",
    logoutTo: "/",
  };
}

export function AccountUserMenu() {
  const pathname = usePathname();
  const { account, logoutDemo } = useAppStore();
  const [profile, setProfile] = useState<AccountMenuProfile | null>(null);

  useEffect(() => {
    if (!account || account.role === "admin") {
      setProfile(null);
      return;
    }
    setProfile((prev) => prev ?? fallbackProfile(account));
    let cancelled = false;
    void loadAccountMenuProfile()
      .then((next) => {
        if (!cancelled && next) setProfile(next);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [account, pathname]);

  if (!account || account.role === "admin") return null;

  const current = profile ?? fallbackProfile(account);

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "inline-flex h-10 max-w-[12rem] items-center gap-2 rounded-full border border-foreground/10 bg-card px-1.5 pr-2.5 text-sm font-medium transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <span className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted">
          {current.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL / user photo
            <img
              src={current.avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <UserRound className="absolute inset-0 m-auto size-3.5 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 truncate">{current.label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={6} align="end">
          <Menu.Popup
            className={cn(
              "min-w-44 origin-top-right rounded-xl border border-foreground/10 bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            <Menu.Item
              closeOnClick
              className={menuItemClass}
              render={<Link href={current.datosHref} />}
            >
              <UserRound className="size-4 shrink-0" />
              Datos
            </Menu.Item>
            <Menu.Item
              closeOnClick
              className={menuItemClass}
              render={<Link href={current.configHref} />}
            >
              <Settings className="size-4 shrink-0" />
              Configuración
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-foreground/8" />
            <Menu.Item
              className={menuItemClass}
              onClick={() => {
                void logoutDemo().then(() => {
                  window.location.href = current.logoutTo;
                });
              }}
            >
              <LogOut className="size-4 shrink-0" />
              Salir
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const menuItemClass = cn(
  "flex h-10 w-full cursor-default items-center gap-2 rounded-lg px-3 text-sm outline-none select-none",
  "data-highlighted:bg-muted data-highlighted:text-foreground",
  "text-muted-foreground"
);
