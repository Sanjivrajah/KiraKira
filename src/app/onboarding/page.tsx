import { AuthGate } from "@/components/auth/auth-gate";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default function OnboardingPage() {
  return <AuthGate gate="onboarding"><OnboardingFlow /></AuthGate>;
}
