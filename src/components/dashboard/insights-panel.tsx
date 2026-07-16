import { AlertTriangle, ArrowUpRight, CircleAlert, CircleHelp, Sparkles } from "lucide-react";
import Link from "next/link";
import type { DashboardInsight } from "@/lib/dashboard/derive";

const icons = {
  warning: AlertTriangle,
  danger: CircleAlert,
  info: CircleHelp,
  brand: Sparkles,
};

export function InsightsPanel({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section className="panel insights-panel" aria-labelledby="insights-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Needs your attention</p>
          <h2 id="insights-title">Alerts & insights</h2>
        </div>
      </div>
      <div className="insight-list">
        {insights.map((insight) => {
          const Icon = icons[insight.tone];
          return (
            <Link className={`insight-row ${insight.tone}`} href={insight.href} key={insight.id}>
              <span className="insight-icon"><Icon aria-hidden="true" size={17} /></span>
              <span><strong>{insight.title}</strong><small>{insight.description}</small></span>
              <ArrowUpRight aria-hidden="true" className="insight-arrow" size={16} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
