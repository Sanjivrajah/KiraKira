"use client";

import { useMemo } from "react";
import { FilePlus2, FileSpreadsheet, Mic2, Plus, ScanLine } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/auth/auth-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { CashOverview } from "@/components/dashboard/cash-overview";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { LoanReadinessCard } from "@/components/dashboard/loan-readiness-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActions, type QuickAction } from "@/components/dashboard/quick-actions";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { DEMO_BUSINESS } from "@/data/demo";
import { useBusiness } from "@/hooks/use-business";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { deriveDashboardInsights, deriveLoanReadiness } from "@/lib/dashboard/derive";
import { formatDashboardDate } from "@/lib/format/date";

const quickActions: QuickAction[] = [
  { label: "Add transaction", description: "Enter it manually", href: "/transactions/new?method=manual", icon: Plus },
  { label: "Scan receipt", description: "Capture an expense", href: "/transactions/new?method=receipt", icon: ScanLine },
  { label: "Record by voice", description: "Speak naturally", href: "/transactions/new?method=voice", icon: Mic2 },
  { label: "Import CSV", description: "Upload many records", href: "/transactions/new?method=csv", icon: FileSpreadsheet },
  { label: "Create invoice", description: "Request payment", href: "/invoices/new", icon: FilePlus2 },
];

export function DashboardContent({ now }: { now: string }) {
  const referenceDate = useMemo(() => new Date(now), [now]);
  const { session } = useAuth();
  const business = useBusiness().data ?? null;
  const firstName = session?.user.name?.split(" ")[0] || "there";
  const businessName = business?.name || "your business";
  const businessId = business?.id || DEMO_BUSINESS.id;
  const summary = useDashboardSummary(businessId, referenceDate);
  const transactions = summary.data?.transactions ?? [];
  const metrics = summary.data?.metrics;
  const cashFlow = summary.data?.cashFlow ?? [];
  const reviewCount = summary.data?.reviewCount ?? 0;
  const metricCards = metrics ? [
    { id: "revenue", label: "Revenue this month", value: metrics.revenue, trend: "From recorded income this month", tone: "positive" as const },
    { id: "expenses", label: "Expenses this month", value: metrics.expenses, trend: "From recorded expenses this month", tone: "neutral" as const },
    { id: "profit", label: "Estimated profit", value: metrics.profit, trend: metrics.profitMargin === null ? "Add income to calculate margin" : `${Math.round(metrics.profitMargin)}% estimated margin`, tone: metrics.profit < 0 ? "warning" as const : "brand" as const },
    { id: "outstanding", label: "Outstanding payments", value: metrics.outstandingPayments, trend: metrics.overdueInvoiceCount ? `${metrics.overdueInvoiceCount} overdue invoice${metrics.overdueInvoiceCount === 1 ? "" : "s"}` : "No overdue invoices", tone: metrics.overdueInvoiceCount ? "warning" as const : "neutral" as const },
  ] : [];
  const insights = metrics ? deriveDashboardInsights({ metrics, reviewCount, business, cashFlow }) : [];
  const readiness = metrics && summary.data
    ? deriveLoanReadiness({ transactions, invoices: summary.data.invoices, metrics, reviewCount, business })
    : null;

  return (
    <AppShell>
      <PageHeader
        eyebrow={formatDashboardDate(referenceDate)}
        title={`Selamat pagi, ${firstName}`}
        description={`A clear look at how ${businessName} is doing this month.`}
        action={<Link className="button button-primary" href="/transactions/new?method=manual"><Plus aria-hidden="true" size={18} />Add transaction</Link>}
      />

      {summary.isPending ? <LoadingState label="Loading dashboard summary" /> : null}
      {summary.isError ? <><ErrorState title="We could not load your dashboard" description="Your records are still on this device. Try loading the summary again." /><button className="button button-secondary" onClick={() => summary.refetch()} type="button">Try again</button></> : null}

      {summary.isSuccess && readiness ? <>
        <section className="metrics-grid" aria-label="Financial summary">
          {metricCards.map((metric) => <MetricCard key={metric.id} {...metric} />)}
        </section>

        <QuickActions actions={quickActions} />

        <div className="dashboard-primary-grid">
          <CashOverview data={cashFlow} />
          <LoanReadinessCard {...readiness} />
        </div>

        <div className="dashboard-secondary-grid">
          <RecentTransactions transactions={transactions} />
          <InsightsPanel insights={insights} />
        </div>

        <p className="foundation-note">Based on current local records · Stored on this device · No bank account is connected.</p>
      </> : null}
    </AppShell>
  );
}

export function DashboardClient({ now }: { now: string }) {
  return <AuthGate gate="dashboard"><DashboardContent now={now} /></AuthGate>;
}
