"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandWordmark } from "@/components/shared/brand-mark";
import { useSaveBusiness } from "@/hooks/use-business";
import { useAuth } from "@/components/auth/auth-provider";
import { useNiagaStore } from "@/store/use-niaga-store";
import { browserStorage } from "@/lib/storage/browser-storage";
import { FRONTEND_STORAGE_KEYS } from "@/frontend/storage";
import { businessOnboardingToDomain, EMPTY_BUSINESS_ONBOARDING } from "@/frontend/view-models";
import { OnboardingProgress } from "./onboarding-progress";
import { OnboardingSuccess } from "./onboarding-success";
import { StagedBusinessForm } from "./staged-business-form";

export function OnboardingFlow() {
  const step = useNiagaStore((state) => state.onboardingStep);
  const setStep = useNiagaStore((state) => state.setOnboardingStep);
  const saveBusiness = useSaveBusiness();
  const { mode } = useAuth();
  const [draft, setDraft] = useState(EMPTY_BUSINESS_ONBOARDING);
  const [saveError, setSaveError] = useState("");

  const save = async () => {
    setSaveError("");
    const now = new Date().toISOString();
    try {
      const saved = await saveBusiness.mutateAsync({
        name: draft.tradingName || draft.legalName,
        type: draft.businessType,
        registrationNumber: draft.registrationNumber,
        tin: draft.tin,
        currency: "MYR",
        preferredLanguage: draft.preferredLanguage,
        legalName: draft.legalName,
        tradingName: draft.tradingName,
        entityType: draft.entityType,
        registrationScheme: draft.registrationScheme,
        sstRegistration: draft.sstRegistration,
        msicCode: draft.msicCode,
        businessActivityDescription: draft.businessActivityDescription,
        addressLine1: draft.addressLine1,
        addressLine2: draft.addressLine2,
        city: draft.city,
        postcode: draft.postcode,
        stateCode: draft.stateCode,
        countryCode: draft.countryCode,
        email: draft.email,
        phone: draft.phone,
      });
      // Canonical browser storage remains a demo-only compatibility adapter.
      // Supabase mode resolves its business context from active memberships.
      if (mode === "demo") {
        const domain = businessOnboardingToDomain(draft, { id: saved.id, now, createdAt: saved.createdAt });
        browserStorage.set(FRONTEND_STORAGE_KEYS.businesses, [domain]);
      }
      setStep(5);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Business setup could not be saved.");
    }
  };

  const descriptions = {
    1: ["Basic business setup", "Start with the identity people recognise."],
    2: ["Business profile", "Add structured contact and address details."],
    3: ["E-Invoice compliance setup", "Add what you know now; optional compliance fields can be completed later."],
  } as const;
  const currentDescription = step <= 3 ? descriptions[step as 1 | 2 | 3] : null;

  return <main className="onboarding-page"><div className="onboarding-shell">
    <Link className="brand-lockup auth-brand" href="/"><BrandWordmark /></Link>
    <OnboardingProgress step={step} />
    <section className="onboarding-card">
      {currentDescription ? <>
        <p className="eyebrow">{currentDescription[0]}</p>
        <h1>{currentDescription[0]}</h1>
        <p className="auth-description">{currentDescription[1]}</p>
        <StagedBusinessForm step={step as 1 | 2 | 3} values={draft} onChange={setDraft} onBack={step > 1 ? () => setStep((step - 1) as 1 | 2) : undefined} onNext={() => setStep((step + 1) as 2 | 3 | 4)} />
      </> : null}
      {step === 4 ? <>
        <p className="eyebrow">MyInvois connection placeholder</p>
        <h1>Review and finish</h1>
        <p className="auth-description">Connection credentials and certificates are not collected in this frontend session.</p>
        <dl className="business-preview">
          <div><dt>Legal name</dt><dd>{draft.legalName}</dd></div>
          <div><dt>Trading name</dt><dd>{draft.tradingName || "Not provided"}</dd></div>
          <div><dt>TIN</dt><dd>{draft.tin || "Complete later"}</dd></div>
          <div><dt>MSIC</dt><dd>{draft.msicCode || "Complete later"}</dd></div>
          <div><dt>Connection</dt><dd>Not connected — no credentials requested</dd></div>
        </dl>
        {saveError ? <p className="field-error" role="alert">{saveError}</p> : null}
        <div className="onboarding-actions split"><button className="button button-secondary" onClick={() => setStep(3)} type="button">Back</button><button className="button button-primary" disabled={saveBusiness.isPending} onClick={save} type="button">Save setup</button></div>
      </> : null}
      {step === 5 ? <OnboardingSuccess businessName={draft.tradingName || draft.legalName} onContinue={async () => undefined} /> : null}
    </section>
  </div></main>;
}
