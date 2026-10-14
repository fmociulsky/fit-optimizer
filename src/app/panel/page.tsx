import { DashboardView } from "@/components/dashboard-view";
import { requireClient } from "@/lib/require-user";

export default async function PanelPage() {
  await requireClient();
  return <DashboardView />;
}
