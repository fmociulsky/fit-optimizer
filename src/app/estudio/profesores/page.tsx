import { GymTeachersView } from "@/components/gym-teachers";
import { requireStudio } from "@/lib/require-user";

export default async function ProfesoresGimnasioPage() {
  await requireStudio();
  return <GymTeachersView />;
}
