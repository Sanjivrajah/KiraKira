import { formatMoney } from "@/lib/format/money";

interface MoneyDisplayProps {
  amount: number;
  className?: string;
  prefix?: string;
}

export function MoneyDisplay({
  amount,
  className = "",
  prefix = "",
}: MoneyDisplayProps) {
  const displayAmount = formatMoney(amount);

  return (
    <span className={`money-display ${className}`.trim()} title={displayAmount}>
      {Number.isFinite(amount) ? prefix : ""}{displayAmount}
    </span>
  );
}
