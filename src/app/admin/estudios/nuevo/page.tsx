import { AdminStudioNewView } from "@/components/admin-studio-new";
import { requireAdmin } from "@/lib/require-user";

export default async function AdminEstudioNuevoPage() {
  await requireAdmin();
  return <AdminStudioNewView />;
}
