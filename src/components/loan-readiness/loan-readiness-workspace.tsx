"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, Info, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import type { LoanReadinessResult } from "@/domain/loan-readiness";
import { useBusiness } from "@/hooks/use-business";
import { useLoanReadiness, useLoanSimulation } from "@/hooks/use-loan-readiness";
import { formatMoney } from "@/lib/format/money";

const statusCopy = {
  insufficient_data: { label: "More history needed", description: "The assessment needs more confirmed records." },
  needs_review: { label: "Needs review", description: "Review the available cash-flow information." },
  not_ready: { label: "Not ready", description: "Current repayment capacity is below the indicative threshold." },
  borderline: { label: "Borderline", description: "Capacity is close to the indicative threshold." },
  ready: { label: "Ready", description: "Confirmed records meet the indicative threshold." },
  strong: { label: "Strong", description: "Confirmed records show stronger indicative capacity." },
} satisfies Record<LoanReadinessResult["status"], { label: string; description: string }>;

const potentialLoanFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDscr(value: number | null) {
  return value === null ? "Unavailable" : `${value.toFixed(2)}x`;
}

function PotentialLoanAmount({ amount }: { amount: number }) {
  const formatted = formatMoney(amount);
  if (!Number.isFinite(amount)) return <strong className="loan-readiness-potential-amount">{formatted}</strong>;

  return (
    <strong aria-label={formatted} className="loan-readiness-potential-amount">
      {potentialLoanFormatter.formatToParts(amount).map((part, index) => (
        <span aria-hidden="true" className={`loan-readiness-money-${part.type}`} key={`${part.type}-${index}`}>{part.value}</span>
      ))}
    </strong>
  );
}

function AssessmentSummary({ assessment }: { assessment: LoanReadinessResult }) {
  const status = statusCopy[assessment.status];
  const confirmedPercentage = Math.round(assessment.confirmedCoverage * 100);
  const inferredDebtCount = assessment.inferredDebts.length;

  return (
    <section aria-label="Readiness summary" className="loan-readiness-summary">
      <div>
        <span className="loan-readiness-summary-label">Assessment status</span>
        <span className={`loan-readiness-status ${assessment.status}`}><ShieldCheck aria-hidden="true" size={17} />{status.label}</span>
        <small>{status.description}</small>
      </div>
      <div>
        <span className="loan-readiness-summary-label">Months of history</span>
        <strong>{assessment.assessmentMonths}</strong>
        <small>Completed months reviewed.</small>
      </div>
      <div>
        <span className="loan-readiness-summary-label">Confirmed coverage</span>
        <strong>{confirmedPercentage}%</strong>
        <small>Of recorded transactions.</small>
      </div>
      <div>
        <span className="loan-readiness-summary-label">Inferred debt {inferredDebtCount === 1 ? "record" : "records"}</span>
        <strong>{inferredDebtCount}</strong>
        <small>Recurring obligations found in confirmed records.</small>
      </div>
    </section>
  );
}

function Result({ assessment }: { assessment: LoanReadinessResult }) {
  const assumptions = assessment.potentialLoanAssumptions;
  const status = statusCopy[assessment.status];

  return (
    <section className="panel loan-readiness-capacity" aria-labelledby="simulation-result-title">
      <div className="loan-readiness-capacity-heading">
        <div>
          <p className="section-kicker">Indicative repayment capacity</p>
          <h2 id="simulation-result-title">Capacity from confirmed records</h2>
          <p>Potential loan amount uses an illustrative {assumptions.annualRatePercent}% annual rate over {assumptions.tenureMonths} monthly instalments.</p>
        </div>
        <span className={`loan-readiness-status ${assessment.status}`}><ShieldCheck aria-hidden="true" size={17} />{status.label}</span>
      </div>

      <div className="loan-readiness-potential">
        <span>Potential loan amount</span>
        <PotentialLoanAmount amount={assessment.potentialLoanAmount} />
        <small>Illustrative only · {assumptions.annualRatePercent}% annual interest · {assumptions.tenureMonths} months</small>
      </div>

      <section aria-label="Primary capacity metrics" className="loan-readiness-metrics">
        <div>
          <span>Proposed instalment</span>
          <strong>{formatMoney(assessment.proposedInstalment)}</strong>
          <small>For the terms entered.</small>
        </div>
        <div>
          <span>Debt-service coverage ratio</span>
          <strong>{formatDscr(assessment.dscr)}</strong>
          <small>Available cash flow against debt service.</small>
        </div>
        <div>
          <span>Maximum safe monthly repayment</span>
          <strong>{formatMoney(assessment.maximumMonthlyRepayment)}</strong>
          <small>Conservative indicative capacity.</small>
        </div>
      </section>

      <section className="loan-readiness-section" aria-labelledby="scenario-heading">
        <div>
          <h3 id="scenario-heading">Scenario comparison</h3>
          <p>These sensitivity checks are not a lending decision.</p>
        </div>
        <dl className="loan-readiness-scenarios">
          <div><dt>Base case</dt><dd>{formatDscr(assessment.scenarios.baseDscr)}</dd><small>Current confirmed cash-flow pattern.</small></div>
          <div><dt>Cautious case</dt><dd>{formatDscr(assessment.scenarios.cautiousDscr)}</dd><small>Lower cash flow and slightly higher debt service.</small></div>
          <div><dt>Stressed case</dt><dd>{formatDscr(assessment.scenarios.stressedDscr)}</dd><small>More conservative cash flow and debt service.</small></div>
        </dl>
      </section>

      <section className="loan-readiness-quality" aria-labelledby="data-quality-heading">
        <div>
          <h3 id="data-quality-heading"><Info aria-hidden="true" size={18} />Data quality and next steps</h3>
          <p>Improve the assessment by confirming complete transaction records before treating this as preparation for a lender conversation.</p>
        </div>
        {assessment.dataIssues.length ? (
          <ul>
            {assessment.dataIssues.map((issue) => <li key={issue}><AlertTriangle aria-hidden="true" size={17} />{issue}</li>)}
          </ul>
        ) : (
          <p className="loan-readiness-quality-success"><CheckCircle2 aria-hidden="true" size={17} />History and confirmed-record coverage meet the indicative minimum.</p>
        )}
        <p className="loan-readiness-debt-disclosure"><CircleAlert aria-hidden="true" size={17} />{assessment.inferredDebts.length
          ? `${assessment.inferredDebts.length} recurring debt obligation${assessment.inferredDebts.length === 1 ? " is" : "s are"} included from confirmed records. Review these inferred obligations before relying on the estimate.`
          : "No recurring debt obligations were inferred from the confirmed records reviewed."}</p>
      </section>

      <p className="loan-readiness-disclaimer"><Info aria-hidden="true" size={17} />{assessment.disclaimer}</p>
    </section>
  );
}

export function LoanReadinessWorkspace() {
  const business = useBusiness().data;
  const readiness = useLoanReadiness(business?.id ?? "");
  const simulation = useLoanSimulation(business?.id ?? "");
  const [principal, setPrincipal] = useState("30000");
  const [rate, setRate] = useState("8");
  const [months, setMonths] = useState("36");
  const result = (simulation.data ?? readiness.data) as LoanReadinessResult | undefined;

  if (readiness.isPending) return <LoadingState label="Calculating loan readiness" />;
  if (readiness.isError) return <ErrorState title="We could not load loan readiness" description="Try again after checking your confirmed transaction records." />;

  return (
    <>
      <PageHeader eyebrow="Financing preparation" title="Loan readiness" description="Explore an indicative assessment from confirmed Niaga records. It is not a lender decision, financing offer, credit score, or financial advice." />
      <div className="loan-readiness-workspace">
        <div className="loan-readiness-left-column">
          {result ? <AssessmentSummary assessment={result} /> : null}
          <section className="panel loan-readiness-form-panel" aria-labelledby="loan-terms-title">
            <div>
              <p className="section-kicker">Indicative simulator</p>
              <h2 id="loan-terms-title">Try your loan terms</h2>
              <p>Adjust the amount, annual interest rate, and repayment period to see how the proposed instalment affects this indicative assessment.</p>
            </div>
            <form onSubmit={(event) => {
              event.preventDefault();
              simulation.mutate({ principal: Number(principal), annualRatePercent: Number(rate), tenureMonths: Number(months) });
            }}>
              <fieldset className="loan-readiness-fields">
                <legend className="visually-hidden">Proposed loan terms</legend>
                <div className="form-field">
                  <label htmlFor="loan-principal">Financing amount (MYR)</label>
                  <input id="loan-principal" inputMode="decimal" min="0.01" onChange={(event) => setPrincipal(event.target.value)} required step="0.01" type="number" value={principal} />
                </div>
                <div className="form-field">
                  <label htmlFor="loan-rate">Annual interest rate (%)</label>
                  <input id="loan-rate" inputMode="decimal" max="100" min="0" onChange={(event) => setRate(event.target.value)} required step="0.01" type="number" value={rate} />
                </div>
                <div className="form-field">
                  <label htmlFor="loan-months">Tenure (months)</label>
                  <input id="loan-months" inputMode="numeric" max="360" min="1" onChange={(event) => setMonths(event.target.value)} required step="1" type="number" value={months} />
                </div>
              </fieldset>
              <div className="loan-readiness-actions">
                <button className="button button-primary" disabled={simulation.isPending} type="submit">{simulation.isPending ? "Calculating…" : "Calculate affordability"}</button>
                <p>Calculations use confirmed records only and are not saved.</p>
              </div>
              {simulation.isError ? <p className="form-alert" role="alert">We could not calculate those terms. Check the values and try again.</p> : null}
            </form>
          </section>
        </div>
        {result ? <Result assessment={result} /> : null}
      </div>
    </>
  );
}
