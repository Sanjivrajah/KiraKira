import { ArrowRight, Check, LayoutDashboard, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/shared/money-display";
import type { Transaction } from "@/types";

export function TransactionSuccessState({ transaction, onAddAnother, onNextItem, remainingItems = 0, nextItemLabel = "transaction" }: {
  transaction: Transaction;
  onAddAnother: () => void;
  onNextItem?: () => void;
  remainingItems?: number;
  nextItemLabel?: string;
}) {
  return (
    <section className="transaction-success-card" aria-labelledby="transaction-success-title">
      <span className="success-mark"><Check aria-hidden="true" size={30} /></span>
      <p className="section-kicker">Saved locally</p>
      <h2 id="transaction-success-title">Transaction added</h2>
      <p>Your reviewed record is stored in this browser and will still be here after a refresh.</p>
      <div className="saved-transaction-summary">
        <div><span>{transaction.type === "income" ? "Money in" : "Money out"}</span><strong>{transaction.description}</strong></div>
        <MoneyDisplay amount={transaction.total} prefix={transaction.type === "income" ? "+" : "−"} />
      </div>
      <div className="success-actions">
        <Link className="button button-primary" href="/transactions"><ListChecks aria-hidden="true" size={18} />View all transactions<ArrowRight aria-hidden="true" size={16} /></Link>
        <Link className="button button-secondary" href="/dashboard"><LayoutDashboard aria-hidden="true" size={18} />Back to dashboard</Link>
        {remainingItems > 0 && onNextItem ? (
          <button className="text-button" onClick={onNextItem} type="button"><Plus aria-hidden="true" size={17} />Review next {nextItemLabel} ({remainingItems} remaining)</button>
        ) : (
          <button className="text-button" onClick={onAddAnother} type="button"><Plus aria-hidden="true" size={17} />Add another transaction</button>
        )}
      </div>
    </section>
  );
}
