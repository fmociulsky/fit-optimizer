import { StudioClientPlanView } from "@/components/studio-client-plan-view";
import { requireStudio } from "@/lib/require-user";

export default async function EstudioAlumnoPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  await requireStudio();
  const { clientId } = await params;
  const { desde } = await searchParams;
  const backHref =
    desde && desde.startsWith("/estudio") ? desde : "/estudio/alumnos";
  return (
    <StudioClientPlanView
      clientId={decodeURIComponent(clientId)}
      backHref={backHref}
    />
  );
}
