"use client";

import { ArrowUpRight, FileText, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/auth/auth-gate";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { useNiagaStore } from "@/store/use-niaga-store";

const activities = [
  { title: "Nasi lemak sales", meta: "Today · DuitNow", amount: 480, type: "income" as const },
  { title: "Grocery purchase", meta: "Yesterday · Cash", amount: 126.4, type: "expense" as const },
  { title: "Catering deposit", meta: "12 Jul · Bank transfer", amount: 850, type: "income" as const },
];

function DashboardContent() {
  const user = useNiagaStore((state) => state.user);
  const business = useNiagaStore((state) => state.business);
  const firstName = user?.name.split(" ")[0] || "there";
  const businessName = business?.name || "Your business";
  return (
    <AppShell>
      <PageHeader eyebrow="Monday, 13 July" title={`Selamat pagi, ${firstName}`} description={`Here’s how ${businessName} is doing today.`} action={<Link className="button button-primary" href="/transactions/new"><Plus aria-hidden="true" size={18} />Add record</Link>} />
      <section className="metrics-grid" aria-label="Business overview">
        <MetricCard label="Money in" value="RM 8,450.00" trend="12.4% this month" tone="positive" />
        <MetricCard label="Money out" value="RM 3,280.40" trend="4.1% this month" tone="neutral" />
        <MetricCard label="Cash balance" value="RM 5,169.60" trend="Healthy cash flow" tone="brand" />
        <MetricCard label="Still to collect" value="RM 1,240.00" trend="2 invoices due" tone="warning" />
      </section>
      <div className="content-grid">
        <section className="panel activity-panel" aria-labelledby="activity-title">
          <div className="panel-heading"><div><p className="section-kicker">Latest updates</p><h2 id="activity-title">Recent activity</h2></div><Link className="text-button" href="/transactions">View all <ArrowUpRight aria-hidden="true" size={16} /></Link></div>
          <div className="activity-list">{activities.map((activity) => <article className="activity-row" key={activity.title}><span className={`activity-icon ${activity.type}`}><ReceiptText aria-hidden="true" size={18} /></span><div className="activity-copy"><h3>{activity.title}</h3><p>{activity.meta}</p></div><MoneyDisplay amount={activity.amount} className={activity.type} prefix={activity.type === "income" ? "+" : "−"} /></article>)}</div>
        </section>
        <aside className="panel next-step" aria-labelledby="next-step-title"><span className="next-step-icon"><FileText aria-hidden="true" size={22} /></span><p className="section-kicker">Set up in minutes</p><h2 id="next-step-title">Your business profile is 80% ready</h2><p>Add your tax identification number to prepare records for future e-invoicing.</p><div className="progress" aria-label="Business profile 80% complete"><span style={{ width: "80%" }} /></div><button className="button button-secondary" type="button">Complete profile</button></aside>
      </div>
      <p className="foundation-note">Frontend demo · Your session and business profile stay in this browser.</p>
    </AppShell>
  );
}

export default function DashboardPage() {
  return <AuthGate gate="dashboard"><DashboardContent /></AuthGate>;
}
