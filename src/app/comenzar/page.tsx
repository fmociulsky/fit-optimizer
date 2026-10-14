import { OnboardingWizard } from "@/components/onboarding-wizard";
import { SiteHeader } from "@/components/site-header";
import { requireClient } from "@/lib/require-user";

export default async function ComenzarPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  await requireClient();
  const { modo } = await searchParams;
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader compact />
      <OnboardingWizard rearmar={modo === "rearmar"} />
    </div>
  );
}
