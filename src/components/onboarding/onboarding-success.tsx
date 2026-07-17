"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function OnboardingSuccess({ businessName, onContinue }: { businessName: string; onContinue: () => Promise<unknown> }) {
  const router = useRouter();
  const { mode } = useAuth();
  return (
    <div className="onboarding-success" aria-live="polite">
      <span><Check aria-hidden="true" size={28} /></span>
      <h2>{businessName} is ready</h2>
      <p>{mode === "supabase" ? "Your business profile has been saved to your workspace. You can now explore the NiagaAI dashboard." : "Your demo profile has been saved on this device. You can now explore the NiagaAI dashboard."}</p>
      <button className="button button-primary" onClick={async () => { await onContinue(); router.replace("/dashboard"); }} type="button">
        Go to dashboard
      </button>
    </div>
  );
}
