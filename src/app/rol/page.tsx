import { Suspense } from "react";
import { RolePicker } from "@/components/role-picker";
import { requireUser } from "@/lib/require-user";

export default async function RolePage() {
  await requireUser();
  return (
    <Suspense
      fallback={
        <p className="px-4 py-16 text-muted-foreground">Cargando…</p>
      }
    >
      <RolePicker />
    </Suspense>
  );
}
