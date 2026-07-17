"use client";

import { ArrowDownRight, ArrowUpRight, FilePlus2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CashOverview } from "@/components/dashboard/cash-overview";
import { MoneyDisplay } from "@/components/shared/money-display";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { DEMO_BUSINESS } from "@/data/demo";
import { useBusiness } from "@/hooks/use-business";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { deriveCashFlow } from "@/lib/dashboard/derive";
import { formatMoney } from "@/lib/format/money";
import type { Transaction } from "@/types";

const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" });

function displayDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

function periodLabel(first?: string, last?: string) {
  if (!first || !last) return "Last 6 months";
  const start = new Date(`${first}-01T00:00:00Z`);
  const end = new Date(`${last}-01T00:00:00Z`);
  const startLabel = new Intl.DateTimeFormat("en-MY", { month: "short", year: start.getUTCFullYear() === end.getUTCFullYear() ? undefined : "numeric", timeZone: "UTC" }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-MY", { month: "short", year: "numeric", timeZone: "UTC" }).format(end);
  return `${startLabel}–${endLabel}`;
}

function MovementRow({ transaction }: { transaction: Transaction }) {
  const income = transaction.type === "income";
  return (
    <li>
      <span className={`cash-movement-icon ${transaction.type}`} aria-hidden="true">
        {income ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
      </span>
      <div>
        <Link href={`/transactions/${transaction.id}`}>{transaction.description}</Link>
        <small>{displayDate(transaction.date)} · {transaction.counterpartyName || transaction.category}</small>
      </div>
      <MoneyDisplay amount={transaction.total} className={transaction.type} prefix={income ? "+" : "−"} />
    </li>
  );
}

export function CashFlowWorkspace({ now }: { now: string }) {
  const referenceDate = useMemo(() => new Date(now), [now]);
  const { mode } = useAuth();
  const businessId = useBusiness().data?.id ?? (mode === "demo" ? DEMO_BUSINESS.id : "");
  const summary = useDashboardSummary(businessId, referenceDate);
  const approvedTransactions = useMemo(
    () => (summary.data?.transactions ?? []).filter((transaction) => transaction.status === "confirmed"),
    [summary.data?.transactions],
  );
  const cashFlow = useMemo(() => deriveCashFlow(approvedTransactions, referenceDate), [approvedTransactions, referenceDate]);
  const income = cashFlow.reduce((sum, point) => sum + point.income, 0);
  const expenses = cashFlow.reduce((sum, point) => sum + point.expenses, 0);
  const net = income - expenses;
  const recentMovements = approvedTransactions.slice(0, 6);
  const period = periodLabel(cashFlow[0]?.monthKey, cashFlow.at(-1)?.monthKey);

  return (
    <>
      <PageHeader
        eyebrow="Owner-approved records"
        title="Cash flow"
        description="See what came in, what went out, and the net movement supported by your approved records."
        action={<Link className="button button-primary" href="/transactions/new"><FilePlus2 aria-hidden="true" size={18} />Add evidence</Link>}
      />

      {summary.isPending ? <LoadingState label="Loading cash flow" /> : null}
      {summary.isError ? <><ErrorState title="We could not load your cash flow" description="Your records are still on this device. Try loading this view again." /><button className="button button-secondary" onClick={() => summary.refetch()} type="button">Try again</button></> : null}

      {summary.isSuccess && approvedTransactions.length === 0 ? (
        <section className="panel cash-flow-empty">
          <h2>No approved cash movements yet</h2>
          <p>Add evidence and approve the prepared record. Your cash-flow view will update automatically.</p>
          <Link className="button button-primary" href="/transactions/new">Add evidence</Link>
        </section>
      ) : null}

      {summary.isSuccess && approvedTransactions.length > 0 ? <div className="cash-flow-workspace">
        <div className="cash-flow-context">
          <div><span>Reporting window</span><strong>{period}</strong></div>
          <p><ShieldCheck aria-hidden="true" size={17} />Only owner-approved records are included.</p>
        </div>

        <section className="cash-flow-totals" aria-label="Cash-flow totals">
          <div><span>Money in</span><MoneyDisplay amount={income} prefix="+" /><small>Approved income</small></div>
          <div><span>Money out</span><MoneyDisplay amount={expenses} prefix="−" /><small>Approved expenses</small></div>
          <div className={net < 0 ? "negative" : "positive"}><span>Net movement</span><MoneyDisplay amount={Math.abs(net)} prefix={net < 0 ? "−" : "+"} /><small>{net < 0 ? "More went out than came in" : "More came in than went out"}</small></div>
        </section>

        <CashOverview data={cashFlow} showDetailsLink={false} />

        <div className="cash-flow-detail-grid">
          <section className="panel cash-flow-breakdown">
            <div className="panel-heading"><div><p className="section-kicker">Monthly record</p><h2>Inflow and outflow</h2></div></div>
            <div className="cash-flow-table-wrap">
              <table>
                <thead><tr><th>Month</th><th>Money in</th><th>Money out</th><th>Net</th></tr></thead>
                <tbody>{cashFlow.toReversed().map((point) => <tr key={point.monthKey}>
                  <th scope="row">{point.month}</th>
                  <td>{formatMoney(point.income)}</td>
                  <td className="expense-value">{formatMoney(point.expenses)}</td>
                  <td className={point.net < 0 ? "negative-value" : "positive-value"}>{point.net > 0 ? "+" : point.net < 0 ? "−" : ""}{formatMoney(Math.abs(point.net))}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="panel cash-movements">
            <div className="panel-heading"><div><p className="section-kicker">Audit-friendly detail</p><h2>Recent movements</h2></div><Link className="text-button" href="/transactions">All records <ArrowUpRight aria-hidden="true" size={16} /></Link></div>
            <ul>{recentMovements.map((transaction) => <MovementRow key={transaction.id} transaction={transaction} />)}</ul>
          </section>
        </div>

        <p className="cash-flow-disclaimer">This view is calculated from approved Niaga records. It is not a bank balance, cash forecast, or audited financial statement.</p>
      </div> : null}
    </>
  );
}
