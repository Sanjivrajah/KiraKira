"use client";

import { useState } from "react";
import { BrandWordmark } from "@/components/shared/brand-mark";
import Link from "next/link";
import { useNiagaStore } from "@/store/use-niaga-store";
import { useSaveBusiness } from "@/hooks/use-business";
import type { BusinessInput } from "@/types";
import { BusinessForm } from "./business-form";
import { BusinessPreview } from "./business-preview";
import { OnboardingProgress } from "./onboarding-progress";
import { OnboardingSuccess } from "./onboarding-success";

export function OnboardingFlow() {
  const step = useNiagaStore((state) => state.onboardingStep);
  const setStep = useNiagaStore((state) => state.setOnboardingStep);
  const saveBusiness = useSaveBusiness();
  const [draft, setDraft] = useState<BusinessInput | null>(null);

  const complete = () => {
    if (!draft) return;
    setStep(3);
  };

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <Link className="brand-lockup auth-brand" href="/">
          <BrandWordmark />
        </Link>
        <OnboardingProgress step={step} />
        <section className="onboarding-card">
          {step === 1 ? (
            <>
              <p className="eyebrow">Tell us about your business</p>
              <h1>Set up your workspace</h1>
              <p className="auth-description">These details personalise your local demo and can be changed later.</p>
              <BusinessForm initialValues={draft} onReview={(business) => { setDraft(business); setStep(2); }} />
            </>
          ) : null}
          {step === 2 && draft ? (
            <>
              <p className="eyebrow">Check before saving</p>
              <h1>Review business details</h1>
              <p className="auth-description">Nothing is sent to a server. Completing setup saves this profile only in your browser.</p>
              <BusinessPreview business={draft} onComplete={complete} onEdit={() => setStep(1)} />
            </>
          ) : null}
          {step === 3 && draft ? <OnboardingSuccess businessName={draft.name} onContinue={() => saveBusiness.mutateAsync(draft)} /> : null}
        </section>
      </div>
    </main>
  );
}
