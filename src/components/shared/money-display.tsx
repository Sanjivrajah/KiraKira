interface MoneyDisplayProps {
  amount: number;
  className?: string;
  prefix?: string;
}

const myrFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
});

export function MoneyDisplay({
  amount,
  className = "",
  prefix = "",
}: MoneyDisplayProps) {
  const displayAmount = Number.isFinite(amount) ? myrFormatter.format(amount) : "Amount unavailable";

  return (
    <span className={`money-display ${className}`.trim()} title={displayAmount}>
      {Number.isFinite(amount) ? prefix : ""}{displayAmount}
    </span>
  );
}
