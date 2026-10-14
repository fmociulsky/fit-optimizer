import { ProfessionalWeek } from "@/components/professional-week";
import { requireProfessional } from "@/lib/require-user";

export default async function ProfesorPage() {
  await requireProfessional();
  return <ProfessionalWeek />;
}
