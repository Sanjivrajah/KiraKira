"use client";

import { useState } from "react";
import Link from "next/link";
import { useNiagaStore } from "@/store/use-niaga-store";
import type { BusinessProfile } from "@/types/business";
import { BusinessForm } from "./business-form";
import { BusinessPreview } from "./business-preview";
import { OnboardingProgress } from "./onboarding-progress";
import { OnboardingSuccess } from "./onboarding-success";

export function OnboardingFlow() {
  const savedBusiness = useNiagaStore((state) => state.business);
  const saveBusiness = useNiagaStore((state) => state.saveBusiness);
  const completeOnboarding = useNiagaStore((state) => state.completeOnboarding);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<BusinessProfile | null>(savedBusiness);

  const complete = () => {
    if (!draft) return;
    saveBusiness(draft);
    setStep(3);
  };

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <Link className="brand-lockup auth-brand" href="/">
          <span className="brand-mark">N</span>NiagaAI
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
          {step === 3 && draft ? <OnboardingSuccess businessName={draft.name} onContinue={completeOnboarding} /> : null}
        </section>
      </div>
    </main>
  );
}
