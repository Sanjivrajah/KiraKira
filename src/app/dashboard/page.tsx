"use client";

import { useEffect, useMemo, useState } from "react";
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
import { calculateMonthlyMetrics } from "@/lib/transactions/query";
import { services } from "@/services";
import { useNiagaStore } from "@/store/use-niaga-store";
import type { Transaction } from "@/types";

function DashboardContent() {
  const user = useNiagaStore((state) => state.user);
  const business = useNiagaStore((state) => state.business);
  const firstName = user?.name.split(" ")[0] || "there";
  const businessName = business?.name || "your business";
  const businessId = business?.id || "business_demo";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  useEffect(() => {
    let active = true;
    services.transactions.initializeDemo(businessId)
      .then((items) => { if (active) setTransactions(items); })
      .catch(() => { if (active) setTransactions([]); });
    return () => { active = false; };
  }, [businessId]);
  const metrics = useMemo(() => {
    const totals = calculateMonthlyMetrics(transactions);
    return dashboardMetrics.map((metric) => {
      if (metric.id === "revenue") return { ...metric, value: totals.revenue, trend: "From recorded income this month" };
      if (metric.id === "expenses") return { ...metric, value: totals.expenses, trend: "From recorded expenses this month" };
      if (metric.id === "profit") return { ...metric, value: totals.profit, trend: totals.revenue ? `${Math.round((totals.profit / totals.revenue) * 100)}% estimated margin` : "Add income to calculate margin" };
      return metric;
    });
  }, [transactions]);
  const reviewCount = transactions.filter((item) => item.status === "needs_review").length;
  const insights = dashboardInsights.map((insight) => insight.id === "review" ? {
    ...insight,
    title: reviewCount ? `${reviewCount} transaction${reviewCount === 1 ? "" : "s"} need review` : "All transactions reviewed",
    description: reviewCount ? insight.description : "Your transaction records are up to date.",
    tone: reviewCount ? insight.tone : "brand" as const,
  } : insight);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Tuesday, 14 July"
        title={`Selamat pagi, ${firstName}`}
        description={`A clear look at how ${businessName} is doing this month.`}
        action={<Link className="button button-primary" href="/transactions/new?method=manual"><Plus aria-hidden="true" size={18} />Add transaction</Link>}
      />

      <section className="metrics-grid" aria-label="Financial summary">
        {metrics.map((metric) => <MetricCard key={metric.id} {...metric} />)}
      </section>

      <QuickActions actions={quickActions} />

      <div className="dashboard-primary-grid">
        <CashOverview data={mockCashFlow} />
        <LoanReadinessCard {...loanReadinessPreview} />
      </div>

      <div className="dashboard-secondary-grid">
        <RecentTransactions transactions={transactions} />
        <InsightsPanel insights={insights} />
      </div>

      <p className="foundation-note">Stored on this device · No bank account is connected.</p>
    </AppShell>
  );
}

export default function DashboardPage() {
  return <AuthGate gate="dashboard"><DashboardContent /></AuthGate>;
}
