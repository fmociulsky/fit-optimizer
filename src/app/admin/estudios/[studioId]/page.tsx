import { AdminStudioDetailView } from "@/components/admin-studio-detail";
import { getContractedStudio } from "@/lib/admin";
import { requireAdmin } from "@/lib/require-user";

export default async function AdminEstudioDetallePage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  await requireAdmin();
  const { studioId: rawId } = await params;
  const studioId = decodeURIComponent(rawId);
  const detail = await getContractedStudio(studioId);
  return (
    <AdminStudioDetailView studioId={studioId} initialDetail={detail} />
  );
}
