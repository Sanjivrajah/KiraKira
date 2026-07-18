import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { LoanReadinessResult } from "@/domain/loan-readiness";
import { formatMoney } from "@/lib/format/money";

const potentialLoanNumberFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function PotentialLoanAmount({ amount }: { amount: number }) {
  const formatted = formatMoney(amount);
  if (!Number.isFinite(amount)) return <strong>{formatted}</strong>;

  return <><span aria-hidden="true" className="score-currency">RM</span><strong aria-label={formatted}>{potentialLoanNumberFormatter.format(amount)}</strong></>;
}

export function LoanReadinessCard({ assessment }: { assessment: LoanReadinessResult | null }) {
  return (
    <aside className="panel loan-preview" aria-labelledby="loan-preview-title">
      <span className="loan-icon"><ShieldCheck aria-hidden="true" size={21} /></span>
      <p className="section-kicker">Indicative cash-flow capacity</p>
      <h2 id="loan-preview-title">Loan-readiness</h2>
      {assessment ? <>
        <div className="score-row"><PotentialLoanAmount amount={assessment.potentialLoanAmount} /></div>
        <p>Potential loan amount using illustrative 8% annual interest over 36 monthly instalments.</p>
        <p><strong>{formatMoney(assessment.maximumMonthlyRepayment)}</strong> indicative maximum monthly repayment</p>
        <p>{assessment.assessmentMonths} months reviewed · {Math.round(assessment.confirmedCoverage * 100)}% records confirmed</p>
      </> : <p>Sign in to view a readiness assessment based on confirmed workspace records.</p>}
      <Link className="text-button" href="/loan-readiness">Open loan readiness <ArrowUpRight aria-hidden="true" size={16} /></Link>
      <small>{assessment?.disclaimer ?? "Indicative cash-flow assessment only. It is not a lender decision, financing offer, credit score, or financial advice."}</small>
    </aside>
  );
}
