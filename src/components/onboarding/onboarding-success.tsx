"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

export function OnboardingSuccess({ businessName, onContinue }: { businessName: string; onContinue: () => void }) {
  const router = useRouter();
  return (
    <div className="onboarding-success" aria-live="polite">
      <span><Check aria-hidden="true" size={28} /></span>
      <h2>{businessName} is ready</h2>
      <p>Your demo profile has been saved on this device. You can now explore the NiagaAI dashboard.</p>
      <button className="button button-primary" onClick={() => { onContinue(); router.replace("/dashboard"); }} type="button">
        Go to dashboard
      </button>
    </div>
  );
}
