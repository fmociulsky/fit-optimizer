import type { ReactNode } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";

export function AuthShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-foreground/8">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Dumbbell className="size-4" />
            </span>
            <span className="font-heading text-lg italic">Enforma</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-4 py-10">
        <h1 className="text-center font-heading text-4xl tracking-tight italic">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-center text-muted-foreground">{hint}</p>
        {children ? <div className="mt-8 w-full">{children}</div> : null}
      </main>
    </div>
  );
}
