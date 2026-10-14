import { ProfessionalHome } from "@/components/professional-home";
import { requireProfessional } from "@/lib/require-user";

export default async function ProfesorAlumnosPage() {
  await requireProfessional();
  return <ProfessionalHome />;
}
