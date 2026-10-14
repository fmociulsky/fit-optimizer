import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BackLink({
  href,
  children = "Volver",
}: {
  href: string;
  children?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "-ml-2 mb-3 h-11 w-fit gap-2 px-2"
      )}
    >
      <ArrowLeft />
      {children}
    </Link>
  );
}
