interface MetricCardProps {
  label: string;
  value: string;
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
      <p className="metric-value">{value}</p>
      <p className="metric-trend">{trend}</p>
    </article>
  );
}
