export function OnboardingProgress({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className="onboarding-progress" aria-label="Setup progress">
      {["Basic", "Profile", "Compliance", "Connection", "Complete"].map((label, index) => {
        const number = index + 1;
        const state = number < step ? "complete" : number === step ? "current" : "upcoming";
        return (
          <li className={state} key={label} aria-current={state === "current" ? "step" : undefined}>
            <span>{number < step ? "✓" : number}</span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}
