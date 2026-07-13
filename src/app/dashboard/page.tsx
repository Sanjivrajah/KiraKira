"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/auth/auth-gate";
import { CashOverview } from "@/components/dashboard/cash-overview";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { LoanReadinessCard } from "@/components/dashboard/loan-readiness-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import {
  dashboardInsights,
  dashboardMetrics,
  loanReadinessPreview,
  mockCashFlow,
  quickActions,
} from "@/data/mock-dashboard";
import { mockTransactions } from "@/data/mock-transactions";
import { useNiagaStore } from "@/store/use-niaga-store";

function DashboardContent() {
  const user = useNiagaStore((state) => state.user);
  const business = useNiagaStore((state) => state.business);
  const firstName = user?.name.split(" ")[0] || "there";
  const businessName = business?.name || "your business";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Tuesday, 14 July"
        title={`Selamat pagi, ${firstName}`}
        description={`A clear look at how ${businessName} is doing this month.`}
        action={<Link className="button button-primary" href="/transactions/new?method=manual"><Plus aria-hidden="true" size={18} />Add transaction</Link>}
      />

      <section className="metrics-grid" aria-label="Financial summary">
        {dashboardMetrics.map((metric) => <MetricCard key={metric.id} {...metric} />)}
      </section>

      <QuickActions actions={quickActions} />

      <div className="dashboard-primary-grid">
        <CashOverview data={mockCashFlow} />
        <LoanReadinessCard {...loanReadinessPreview} />
      </div>

      <div className="dashboard-secondary-grid">
        <RecentTransactions transactions={mockTransactions} />
        <InsightsPanel insights={dashboardInsights} />
      </div>

      <p className="foundation-note">Demo data only · No bank account is connected.</p>
    </AppShell>
  );
}

export default function DashboardPage() {
  return <AuthGate gate="dashboard"><DashboardContent /></AuthGate>;
}
