import { AgendaView } from "@/components/agenda-view";
import { requireClient } from "@/lib/require-user";

export default async function AgendaPage() {
  await requireClient();
  return <AgendaView />;
}
