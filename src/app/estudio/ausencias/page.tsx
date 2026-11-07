import { GymAbsencesView } from "@/components/gym-absences";
import { requireStudio } from "@/lib/require-user";

export default async function AusenciasEstudioPage() {
  await requireStudio();
  return <GymAbsencesView />;
}
