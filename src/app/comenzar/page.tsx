import { OnboardingWizard } from "@/components/onboarding-wizard";
import { SiteHeader } from "@/components/site-header";

export default async function ComenzarPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const { modo } = await searchParams;
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader compact />
      <OnboardingWizard rearmar={modo === "rearmar"} />
    </div>
  );
}
