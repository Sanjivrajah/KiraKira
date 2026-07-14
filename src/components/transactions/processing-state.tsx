"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";

const steps = ["Reading the demo input", "Structuring transaction details", "Preparing your review"];

export function ProcessingState({ onCancel, onComplete }: { onCancel: () => void; onComplete: () => void }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const stepOne = window.setTimeout(() => setActiveStep(1), 650);
    const stepTwo = window.setTimeout(() => setActiveStep(2), 1300);
    const done = window.setTimeout(onComplete, 2050);
    return () => [stepOne, stepTwo, done].forEach(window.clearTimeout);
  }, [onComplete]);

  return (
    <section className="processing-card" aria-labelledby="processing-title" aria-live="polite">
      <span className="processing-orbit"><LoaderCircle aria-hidden="true" size={34} /></span>
      <p className="section-kicker">Demo processing · Step 2 of 3</p>
      <h2 id="processing-title">Preparing a sample extraction</h2>
      <p>No real AI, OCR, or speech recognition is running. We’re loading representative data for you to review.</p>
      <ol className="processing-steps">
        {steps.map((step, index) => (
          <li className={index < activeStep ? "complete" : index === activeStep ? "active" : ""} key={step}>
            <span>{index < activeStep ? <Check aria-hidden="true" size={15} /> : index + 1}</span>{step}
          </li>
        ))}
      </ol>
      <button className="button button-secondary" onClick={onCancel} type="button"><RotateCcw aria-hidden="true" size={17} />Cancel and restart</button>
    </section>
  );
}
