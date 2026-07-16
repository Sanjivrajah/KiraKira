import { MoneyDisplay } from "@/components/shared/money-display";

interface MetricCardProps {
  label: string;
  value: number;
  trend: string;
  tone?: "positive" | "neutral" | "brand" | "warning";
}

export function MetricCard({
  label,
  value,
  trend,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <article className={`metric-card ${tone}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value"><MoneyDisplay amount={value} /></p>
      <p className="metric-trend">{trend}</p>
    </article>
  );
}
