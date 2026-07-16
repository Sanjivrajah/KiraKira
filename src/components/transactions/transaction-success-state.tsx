import { ArrowRight, Check, CircleCheck, CircleDot, LayoutDashboard, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/shared/money-display";
import type { ApprovalAuditEvent } from "@/frontend/view-models";
import type { Transaction } from "@/types";

export function TransactionSuccessState({ transaction, approvalTimeline = [], onAddAnother, onNextItem, remainingItems = 0, nextItemLabel = "transaction" }: {
  transaction: Transaction;
  approvalTimeline?: ApprovalAuditEvent[];
  onAddAnother: () => void;
  onNextItem?: () => void;
  remainingItems?: number;
  nextItemLabel?: string;
}) {
  return (
    <section className="transaction-success-card" aria-labelledby="transaction-success-title">
      <span className="success-mark"><Check aria-hidden="true" size={30} /></span>
      <p className="section-kicker">Owner approval complete</p>
      <h2 id="transaction-success-title">Record approved</h2>
      <p>Your correction and approval are stored with the evidence used to prepare this record.</p>
      <div className="saved-transaction-summary">
        <div><span>{transaction.type === "income" ? "Money in" : "Money out"}</span><strong>{transaction.description}</strong></div>
        <MoneyDisplay amount={transaction.total} prefix={transaction.type === "income" ? "+" : "−"} />
      </div>
      {approvalTimeline.length ? (
        <div className="approval-result-grid">
          <section className="approval-timeline" aria-labelledby="approval-timeline-title">
            <p className="section-kicker">Audit trail</p>
            <h3 id="approval-timeline-title">What happened to this record</h3>
            <ol>
              {approvalTimeline.map((event) => (
                <li key={event.id}>
                  <CircleCheck aria-hidden="true" size={18} />
                  <div><strong>{event.title}</strong><span>{event.detail}</span></div>
                </li>
              ))}
            </ol>
          </section>
          <section className="approval-status" aria-labelledby="approval-status-title">
            <p className="section-kicker">Current status</p>
            <h3 id="approval-status-title">Checks after approval</h3>
            <dl>
              <div><dt>Owner approval</dt><dd><CircleCheck aria-hidden="true" size={16} />Complete</dd></div>
              <div><dt>Niaga record checks</dt><dd><CircleCheck aria-hidden="true" size={16} />Passed</dd></div>
              <div><dt>e-Invoice preparation</dt><dd className="needs-action"><CircleDot aria-hidden="true" size={16} />1 detail to add</dd></div>
              <div><dt>MyInvois status</dt><dd>Not submitted</dd></div>
            </dl>
            <Link className="text-link" href="/invoices/new">Fix e-Invoice details<ArrowRight aria-hidden="true" size={15} /></Link>
          </section>
        </div>
      ) : null}
      <div className="success-actions">
        <Link className="button button-primary" href="/transactions"><ListChecks aria-hidden="true" size={18} />View records<ArrowRight aria-hidden="true" size={16} /></Link>
        <Link className="button button-secondary" href="/dashboard"><LayoutDashboard aria-hidden="true" size={18} />Evidence inbox</Link>
        {remainingItems > 0 && onNextItem ? (
          <button className="text-button" onClick={onNextItem} type="button"><Plus aria-hidden="true" size={17} />Review next {nextItemLabel} ({remainingItems} remaining)</button>
        ) : (
          <button className="text-button" onClick={onAddAnother} type="button"><Plus aria-hidden="true" size={17} />Add more evidence</button>
        )}
      </div>
    </section>
  );
}
