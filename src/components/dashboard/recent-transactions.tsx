import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/shared/money-display";
import type { Transaction, TransactionSourceType, TransactionStatus } from "@/types";

const sourceLabels: Record<TransactionSourceType, string> = {
  receipt: "Receipt",
  voice: "Voice",
  manual: "Manual",
  csv: "CSV",
  bank_statement: "Bank",
  whatsapp: "WhatsApp",
};

const statusLabels: Record<TransactionStatus, string> = {
  draft: "Draft",
  needs_review: "Review",
  confirmed: "Reviewed",
  failed: "Failed",
};

const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short" });

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="panel transactions-panel" aria-labelledby="recent-transactions-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Latest records</p>
          <h2 id="recent-transactions-title">Recent transactions</h2>
        </div>
        <Link className="text-button" href="/transactions">View all <ArrowUpRight aria-hidden="true" size={16} /></Link>
      </div>

      {transactions.length === 0 ? (
        <div className="dashboard-empty">
          <p>No transactions yet</p>
          <span>Add your first sale or expense to see it here.</span>
          <Link className="button button-secondary" href="/transactions/new">Add transaction</Link>
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.slice(0, 5).map((transaction) => (
            <article className="transaction-row" key={transaction.id}>
              <span className={`transaction-type-icon ${transaction.type}`}>
                {transaction.type === "income" ? <ArrowDownLeft aria-hidden="true" size={17} /> : <ArrowUpRight aria-hidden="true" size={17} />}
              </span>
              <div className="transaction-main">
                <h3>{transaction.description}</h3>
                <p>{dateFormatter.format(new Date(`${transaction.date}T00:00:00`))} · {transaction.category}</p>
              </div>
              <span className="transaction-source">{sourceLabels[transaction.sourceType]}</span>
              <span className={`status-badge ${transaction.status}`}>{statusLabels[transaction.status]}</span>
              <MoneyDisplay amount={transaction.total} className={transaction.type} prefix={transaction.type === "income" ? "+" : "−"} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
