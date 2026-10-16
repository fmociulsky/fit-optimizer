import { GymStatsView } from "@/components/gym-stats";
import { requireStudio } from "@/lib/require-user";

export default async function EstadisticasEstudioPage() {
  await requireStudio();
  return <GymStatsView />;
}
