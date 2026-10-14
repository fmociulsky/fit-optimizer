import { ProfessionalPlanEditor } from "@/components/professional-plan-editor";
import { requireProfessional } from "@/lib/require-user";

export default async function ProfesorAlumnoPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireProfessional();
  const { clientId } = await params;
  return <ProfessionalPlanEditor clientId={decodeURIComponent(clientId)} />;
}
