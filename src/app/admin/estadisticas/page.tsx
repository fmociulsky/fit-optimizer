import { AdminStatsView } from "@/components/admin-stats";
import { requireAdmin } from "@/lib/require-user";

export default async function AdminEstadisticasPage() {
  await requireAdmin();
  return <AdminStatsView />;
}
