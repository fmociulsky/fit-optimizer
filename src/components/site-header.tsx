"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/8 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Dumbbell className="size-4" />
          </span>
          <span className="font-heading text-lg italic">Enforma</span>
        </Link>
        {!compact && (
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/panel"
              className={cn(
                "rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === "/panel" && "bg-muted text-foreground"
              )}
            >
              Mi plan
            </Link>
            <Link
              href="/comenzar"
              className={cn(
                "rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === "/comenzar" && "bg-muted text-foreground"
              )}
            >
              Nuevo plan
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
