import { OnboardingWizard } from "@/components/onboarding-wizard";
import { SiteHeader } from "@/components/site-header";

export default function ComenzarPage() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader compact />
      <OnboardingWizard />
    </div>
  );
}
