import { ArrowRight, Check, LayoutDashboard, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/shared/money-display";
import type { Transaction } from "@/types/finance";

export function TransactionSuccessState({ transaction, onAddAnother, onNextReceipt, remainingReceipts = 0 }: {
  transaction: Transaction;
  onAddAnother: () => void;
  onNextReceipt?: () => void;
  remainingReceipts?: number;
}) {
  return (
    <section className="transaction-success-card" aria-labelledby="transaction-success-title">
      <span className="success-mark"><Check aria-hidden="true" size={30} /></span>
      <p className="section-kicker">Saved locally</p>
      <h2 id="transaction-success-title">Transaction added</h2>
      <p>Your reviewed record is stored in this browser and will still be here after a refresh.</p>
      <div className="saved-transaction-summary">
        <div><span>{transaction.type === "income" ? "Money in" : "Money out"}</span><strong>{transaction.description}</strong></div>
        <MoneyDisplay amount={transaction.amount} prefix={transaction.type === "income" ? "+" : "−"} />
      </div>
      <div className="success-actions">
        <Link className="button button-primary" href="/transactions"><ListChecks aria-hidden="true" size={18} />View all transactions<ArrowRight aria-hidden="true" size={16} /></Link>
        <Link className="button button-secondary" href="/dashboard"><LayoutDashboard aria-hidden="true" size={18} />Back to dashboard</Link>
        {remainingReceipts > 0 && onNextReceipt ? (
          <button className="text-button" onClick={onNextReceipt} type="button"><Plus aria-hidden="true" size={17} />Review next receipt ({remainingReceipts} remaining)</button>
        ) : (
          <button className="text-button" onClick={onAddAnother} type="button"><Plus aria-hidden="true" size={17} />Add another transaction</button>
        )}
      </div>
    </section>
  );
}
