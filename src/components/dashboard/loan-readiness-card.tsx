import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function LoanReadinessCard({ score, summary }: { score: number; summary: string }) {
  return (
    <aside className="panel loan-preview" aria-labelledby="loan-preview-title">
      <span className="loan-icon"><ShieldCheck aria-hidden="true" size={21} /></span>
      <p className="section-kicker">Financing snapshot</p>
      <h2 id="loan-preview-title">Loan-readiness</h2>
      <div className="score-row"><strong>{score}</strong><span>/100</span></div>
      <div className="score-track" aria-label={`Loan-readiness score ${score} out of 100`}><span style={{ width: `${score}%` }} /></div>
      <p>{summary}</p>
      <Link className="text-button" href="/loan-readiness">See how to improve <ArrowUpRight aria-hidden="true" size={16} /></Link>
      <small>Demo estimate only — not a lending decision.</small>
    </aside>
  );
}
