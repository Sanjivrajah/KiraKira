import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/shared/money-display";
import type { CashFlowPoint } from "@/data/mock-dashboard";

export function CashOverview({ data }: { data: CashFlowPoint[] }) {
  const maxValue = Math.max(...data.flatMap((point) => [point.income, point.expenses]));
  const current = data.at(-1);

  return (
    <section className="panel cash-panel" aria-labelledby="cash-overview-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Last 6 months</p>
          <h2 id="cash-overview-title">Cash overview</h2>
        </div>
        <Link className="text-button" href="/cash-flow">Details <ArrowUpRight aria-hidden="true" size={16} /></Link>
      </div>

      <div className="chart-legend" aria-hidden="true">
        <span><i className="income" />Income</span>
        <span><i className="expenses" />Expenses</span>
      </div>

      <div className="cash-chart" role="img" aria-label={data.map((point) => `${point.month}: income RM ${point.income}, expenses RM ${point.expenses}, net cash flow RM ${point.net}`).join(". ")}>
        {data.map((point) => (
          <div className="chart-column" key={point.month}>
            <div className="bar-pair" aria-hidden="true">
              <span className="chart-bar income" style={{ height: `${Math.max(8, (point.income / maxValue) * 100)}%` }} />
              <span className="chart-bar expenses" style={{ height: `${Math.max(8, (point.expenses / maxValue) * 100)}%` }} />
            </div>
            <span className="chart-month">{point.month}</span>
          </div>
        ))}
      </div>

      {current ? (
        <div className="net-cash-summary">
          <span>July net cash flow</span>
          <MoneyDisplay amount={current.net} prefix="+" />
        </div>
      ) : null}
    </section>
  );
}
