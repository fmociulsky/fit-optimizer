"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useAppStore } from "@/components/app-provider";
import {
  clientHomeHref,
  isClientPath,
  isProfessionalPath,
  isStudioPath,
} from "@/lib/roles";

export function RoleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { ready, account, state } = useAppStore();

  useEffect(() => {
    if (!isLoaded || !ready) return;
    if (
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up") ||
      pathname.startsWith("/entrar-profesor") ||
      pathname.startsWith("/entrar-usuario") ||
      pathname.startsWith("/entrar-estudio") ||
      pathname.startsWith("/unirse")
    ) {
      return;
    }
    const signedIn = Boolean(userId) || Boolean(account);
    if (!signedIn) return;
    if (!account) {
      if (pathname !== "/rol") router.replace("/rol");
      return;
    }
    if (pathname === "/") {
      router.replace(clientHomeHref(account, Boolean(state)));
      return;
    }
    if (account.role === "professional" && isClientPath(pathname)) {
      router.replace("/profesor");
      return;
    }
    if (account.role === "studio" && !isStudioPath(pathname) && pathname !== "/rol") {
      router.replace("/estudio");
      return;
    }
    if (account.role === "client" && (isProfessionalPath(pathname) || isStudioPath(pathname))) {
      router.replace(clientHomeHref(account, Boolean(state)));
    }
  }, [account, isLoaded, pathname, ready, router, state, userId]);

  return children;
}
