import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/shared/money-display";
import { formatMoney } from "@/lib/format/money";
import type { CashFlowPoint } from "@/lib/dashboard/derive";

function barHeight(value: number, maxValue: number) {
  if (value <= 0) return "0%";
  return `${Math.max(3, (value / maxValue) * 100)}%`;
}

export function CashOverview({ data, showDetailsLink = true }: { data: CashFlowPoint[]; showDetailsLink?: boolean }) {
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.income, point.expenses]));
  const totalNet = data.reduce((sum, point) => sum + point.net, 0);

  return (
    <section className="panel cash-panel" aria-labelledby="cash-overview-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Last 6 months</p>
          <h2 id="cash-overview-title">Cash overview</h2>
        </div>
        {showDetailsLink ? <Link className="text-button" href="/cash-flow">View cash flow <ArrowUpRight aria-hidden="true" size={16} /></Link> : null}
      </div>

      <div className="chart-legend" aria-hidden="true">
        <span><i className="income" />Income</span>
        <span><i className="expenses" />Expenses</span>
      </div>

      <div className="cash-chart" role="img" aria-label={data.map((point) => `${point.month}: income ${formatMoney(point.income)}, expenses ${formatMoney(point.expenses)}, net cash flow ${formatMoney(point.net)}`).join(". ")}>
        {data.map((point) => (
          <div className="chart-column" key={point.month}>
            <div className="bar-pair" aria-hidden="true">
              <span className="chart-bar income" style={{ height: barHeight(point.income, maxValue) }} />
              <span className="chart-bar expenses" style={{ height: barHeight(point.expenses, maxValue) }} />
            </div>
            <span className="chart-month">{point.month}</span>
          </div>
        ))}
      </div>

      {data.length ? (
        <div className="net-cash-summary">
          <span>Last 6 months net cash flow</span>
          <MoneyDisplay amount={totalNet} prefix={totalNet > 0 ? "+" : ""} />
        </div>
      ) : null}
    </section>
  );
}
