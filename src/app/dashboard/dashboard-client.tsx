"use client";

import { useMemo } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, FileCheck2, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/auth/auth-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { DEMO_BUSINESS } from "@/data/demo";
import { useBusiness } from "@/hooks/use-business";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { formatDashboardDate } from "@/lib/format/date";
import type { Transaction } from "@/types";

const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short" });

function EvidenceQueue({ transactions }: { transactions: Transaction[] }) {
  const items = transactions.filter((item) => item.status === "needs_review");

  return (
    <section className="panel evidence-queue" aria-labelledby="evidence-queue-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Needs your attention</p>
          <h2 id="evidence-queue-title">{items.length ? `${items.length} ${items.length === 1 ? "record needs" : "records need"} your check` : "Nothing waiting for you"}</h2>
        </div>
        <Link className="text-button" href="/transactions?status=needs_review">View records <ArrowRight aria-hidden="true" size={16} /></Link>
      </div>

      {items.length ? (
        <div className="evidence-queue-list">
          {items.map((transaction, index) => {
            const isMismatchDemo = transaction.id === "txn_002";
            const href = isMismatchDemo ? "/transactions/new?method=receipt&demo=ambiguous" : `/transactions/${transaction.id}`;
            return (
              <Link className={`evidence-queue-item${index === 0 ? " priority" : ""}`} href={href} key={transaction.id}>
                <span className="evidence-document-icon"><ReceiptText aria-hidden="true" size={20} /></span>
                <span className="evidence-item-copy">
                  <span className="trust-label evidence">From your evidence</span>
                  <strong>{transaction.description}</strong>
                  <small>{isMismatchDemo ? "Receipt shows RM86.40 · prepared draft says RM68.40" : `${transaction.counterpartyName || "Source needs confirmation"} · ${dateFormatter.format(new Date(`${transaction.date}T00:00:00`))}`}</small>
                  <span className="evidence-reason"><CircleAlert aria-hidden="true" size={15} />{isMismatchDemo ? "Amount does not match the receipt" : "Some prepared details need confirmation"}</span>
                </span>
                <span className="evidence-item-action">Check record <ArrowRight aria-hidden="true" size={16} /></span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-empty"><CheckCircle2 aria-hidden="true" size={28} /><p>All caught up</p><span>New evidence that needs a decision will appear here.</span></div>
      )}
    </section>
  );
}

export function DashboardContent({ now }: { now: string }) {
  const referenceDate = useMemo(() => new Date(now), [now]);
  const { session } = useAuth();
  const business = useBusiness().data ?? null;
  const firstName = session?.user.name?.split(" ")[0] || "there";
  const businessId = business?.id || DEMO_BUSINESS.id;
  const summary = useDashboardSummary(businessId, referenceDate);
  const transactions = summary.data?.transactions ?? [];
  const approvedCount = transactions.filter((item) => item.status === "confirmed").length;
  const reviewCount = transactions.filter((item) => item.status === "needs_review").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow={formatDashboardDate(referenceDate)}
        title="Evidence inbox"
        description={`Hi ${firstName}. Check what Niaga prepared for ${business?.name || "your business"}, correct anything uncertain, then approve the record.`}
        action={<Link className="button button-primary" href="/transactions/new"><Plus aria-hidden="true" size={18} />Add evidence</Link>}
      />

      {summary.isPending ? <LoadingState label="Loading evidence inbox" /> : null}
      {summary.isError ? (() => {
        console.error("Dashboard Summary Error:", summary.error);
        return <><ErrorState title="We could not load your evidence inbox" description="Your records are still on this device. Try loading the inbox again." /><button className="button button-secondary" onClick={() => summary.refetch()} type="button">Try again</button></>;
      })() : null}

      {summary.isSuccess ? <>
        <section className="evidence-summary" aria-label="Record coverage">
          <div><CircleAlert aria-hidden="true" size={18} /><span><strong>{reviewCount}</strong> need your check</span></div>
          <div><CheckCircle2 aria-hidden="true" size={18} /><span><strong>{approvedCount}</strong> owner-approved</span></div>
          <div><FileCheck2 aria-hidden="true" size={18} /><span><strong>{transactions.length}</strong> records captured</span></div>
        </section>

        <EvidenceQueue transactions={transactions} />

        <section className="workflow-assurance" aria-label="How Niaga handles your evidence">
          <span className="trust-label suggestion">Niaga suggestion</span>
          <p>Niaga prepares a draft. You remain in control of every correction and approval.</p>
          <span className="trust-label check">Niaga check</span>
          <p>Internal checks flag missing or inconsistent details before e-Invoice preparation.</p>
          <span className="trust-label myinvois">MyInvois status: Not submitted</span>
        </section>

        <RecentTransactions transactions={transactions} />
        <p className="foundation-note">Local demo records · No submission is sent to MyInvois.</p>
      </> : null}
    </AppShell>
  );
}

export function DashboardClient({ now }: { now: string }) {
  return <AuthGate gate="dashboard"><DashboardContent now={now} /></AuthGate>;
}
