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
  return (
    <span className={`money-display ${className}`.trim()}>
      {prefix}{myrFormatter.format(amount)}
    </span>
  );
}
