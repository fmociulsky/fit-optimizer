import { GymClientsView } from "@/components/gym-clients";
import { requireStudio } from "@/lib/require-user";

export default async function AlumnosGimnasioPage() {
  await requireStudio();
  return <GymClientsView />;
}
