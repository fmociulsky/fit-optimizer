import { AdminStudiosView } from "@/components/admin-studios";
import { requireAdmin } from "@/lib/require-user";

export default async function AdminEstudiosPage() {
  await requireAdmin();
  return <AdminStudiosView />;
}
