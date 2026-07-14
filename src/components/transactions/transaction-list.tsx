"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, FilterX, Plus, Search } from "lucide-react";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { mockTransactions } from "@/data/mock-transactions";
import { emptyTransactionFilters, filterAndSortTransactions, type TransactionFilters, type TransactionSort } from "@/lib/transactions/query";
import { initializeTransactions, updateTransaction } from "@/lib/transactions/storage";
import type { Transaction, TransactionSourceType, TransactionStatus } from "@/types";

export const sourceLabels: Record<TransactionSourceType, string> = {
  receipt: "Receipt", voice: "Voice", manual: "Manual", csv: "CSV",
  bank_statement: "Bank statement", whatsapp: "WhatsApp",
};
export const statusLabels: Record<TransactionStatus, string> = {
  draft: "Draft", needs_review: "Needs review", confirmed: "Reviewed", failed: "Failed",
};
const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" });

function displayDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

function Counterparty({ transaction }: { transaction: Transaction }) {
  return <>{transaction.counterpartyName || "—"}</>;
}

export function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => initializeTransactions(mockTransactions));
  const [filters, setFilters] = useState<TransactionFilters>(emptyTransactionFilters);
  const [sort, setSort] = useState<TransactionSort>("newest");
  const [message, setMessage] = useState(() => {
    if (new URLSearchParams(window.location.search).get("deleted") !== "1") return "";
    window.history.replaceState(null, "", "/transactions");
    return "Transaction deleted successfully.";
  });

  const categories = useMemo(() => [...new Set(transactions.map((item) => item.category))].sort(), [transactions]);
  const visible = useMemo(() => filterAndSortTransactions(transactions, filters, sort), [transactions, filters, sort]);
  const reviewCount = transactions.filter((item) => item.status === "needs_review").length;
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(emptyTransactionFilters);
  const setFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const markReviewed = (transaction: Transaction) => {
    const updated = { ...transaction, status: "confirmed" as const, updatedAt: new Date().toISOString() };
    if (!updateTransaction(updated)) {
      setMessage("We could not save that change. Please try again.");
      return;
    }
    setTransactions((current) => current.map((item) => item.id === transaction.id ? updated : item));
    setMessage(`“${transaction.description}” marked as reviewed.`);
  };

  return (
    <>
      <PageHeader eyebrow="Money in and out" title="Transactions" description="Search, review, and manage every business record in one place." action={<Link className="button button-primary" href="/transactions/new"><Plus aria-hidden="true" size={18} />Add transaction</Link>} />

      {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}<button aria-label="Dismiss message" onClick={() => setMessage("")} type="button">×</button></div> : null}

      <section className="transaction-toolbar" aria-label="Transaction filters">
        <div className="review-tabs" role="group" aria-label="Review view">
          <button className={filters.status === "all" ? "active" : ""} onClick={() => setFilter("status", "all")} type="button">All <span>{transactions.length}</span></button>
          <button className={filters.status === "needs_review" ? "active" : ""} onClick={() => setFilter("status", "needs_review")} type="button">Needs review <span>{reviewCount}</span></button>
        </div>
        <label className="transaction-search"><Search aria-hidden="true" size={18} /><span className="sr-only">Search transactions</span><input onChange={(event) => setFilter("search", event.target.value)} placeholder="Search description or name" type="search" value={filters.search} /></label>
        <div className="transaction-filter-grid">
          <label><span>Type</span><select onChange={(e) => setFilter("type", e.target.value as TransactionFilters["type"])} value={filters.type}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></label>
          <label><span>Category</span><select onChange={(e) => setFilter("category", e.target.value)} value={filters.category}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label><span>Source</span><select onChange={(e) => setFilter("source", e.target.value as TransactionFilters["source"])} value={filters.source}><option value="all">All sources</option>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Status</span><select onChange={(e) => setFilter("status", e.target.value as TransactionFilters["status"])} value={filters.status}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>From</span><input onChange={(e) => setFilter("dateFrom", e.target.value)} type="date" value={filters.dateFrom} /></label>
          <label><span>To</span><input min={filters.dateFrom || undefined} onChange={(e) => setFilter("dateTo", e.target.value)} type="date" value={filters.dateTo} /></label>
          <label><span>Sort by</span><select onChange={(e) => setSort(e.target.value as TransactionSort)} value={sort}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select></label>
          <button className="reset-filters" disabled={!hasFilters && sort === "newest"} onClick={() => { setFilters(emptyTransactionFilters); setSort("newest"); }} type="button"><FilterX aria-hidden="true" size={17} />Reset filters</button>
        </div>
      </section>

      <div className="transaction-results-heading"><p><strong>{visible.length}</strong> {visible.length === 1 ? "transaction" : "transactions"}</p>{reviewCount > 0 ? <span>{reviewCount} need{reviewCount === 1 ? "s" : ""} review</span> : <span className="all-reviewed">All reviewed</span>}</div>

      {visible.length === 0 ? (
        <section className="transaction-empty panel"><h2>{transactions.length ? "No matching transactions" : "No transactions yet"}</h2><p>{transactions.length ? "Try changing or clearing your filters." : "Add your first income or expense to start tracking your business."}</p>{transactions.length ? <button className="button button-secondary" onClick={() => setFilters(emptyTransactionFilters)} type="button">Clear filters</button> : <Link className="button button-primary" href="/transactions/new">Add transaction</Link>}</section>
      ) : <>
        <div className="transaction-table-wrap panel">
          <table className="transaction-table"><thead><tr><th>Date</th><th>Description</th><th>Merchant / customer</th><th>Category</th><th>Source</th><th>Status</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{visible.map((transaction) => <tr key={transaction.id}><td>{displayDate(transaction.date)}</td><td><Link href={`/transactions/${transaction.id}`}><strong>{transaction.description}</strong><span className={`type-label ${transaction.type}`}>{transaction.type}</span></Link></td><td><Counterparty transaction={transaction} /></td><td>{transaction.category}</td><td>{sourceLabels[transaction.sourceType]}</td><td><span className={`status-badge ${transaction.status}`}>{statusLabels[transaction.status]}</span></td><td><MoneyDisplay amount={transaction.total} className={transaction.type} prefix={transaction.type === "income" ? "+" : "−"} /></td><td>{transaction.status === "needs_review" ? <button className="review-button" onClick={() => markReviewed(transaction)} type="button">Mark reviewed</button> : <Link className="row-link" href={`/transactions/${transaction.id}`} aria-label={`View ${transaction.description}`}><ChevronRight aria-hidden="true" size={18} /></Link>}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="transaction-cards">{visible.map((transaction) => <article className="transaction-card" key={transaction.id}><Link className="transaction-card-link" href={`/transactions/${transaction.id}`}><div className="transaction-card-top"><span className={`type-label ${transaction.type}`}>{transaction.type}</span><MoneyDisplay amount={transaction.total} className={transaction.type} prefix={transaction.type === "income" ? "+" : "−"} /></div><h2>{transaction.description}</h2><p>{displayDate(transaction.date)} · <Counterparty transaction={transaction} /></p><div className="transaction-card-meta"><span>{transaction.category}</span><span>{sourceLabels[transaction.sourceType]}</span><span className={`status-badge ${transaction.status}`}>{statusLabels[transaction.status]}</span></div></Link>{transaction.status === "needs_review" ? <button className="review-button" onClick={() => markReviewed(transaction)} type="button"><CheckCircle2 aria-hidden="true" size={16} />Mark reviewed</button> : null}</article>)}</div>
      </>}
    </>
  );
}
