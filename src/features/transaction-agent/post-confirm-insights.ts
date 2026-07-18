import type { ConfirmedTransaction } from "@/features/transaction-agent/transaction-record.schema";

export type AgentLocale = "en" | "ms";

const myr = (locale: AgentLocale, value: number) =>
  new Intl.NumberFormat(locale === "ms" ? "ms-MY" : "en-MY", { style: "currency", currency: "MYR" }).format(value);

const active = (transaction: ConfirmedTransaction) => transaction.status !== "voided";

/**
 * One short, non-blocking observation to volunteer after a save — turning bookkeeping into
 * light coaching. Pure and deterministic; it reads only confirmed records already visible to
 * the owner and never fabricates figures. Returns null when nothing is clearly worth saying.
 */
export function buildPostConfirmInsight(
  confirmed: ConfirmedTransaction,
  recent: readonly ConfirmedTransaction[],
  locale: AgentLocale = "en",
): string | null {
  const ms = locale === "ms";
  const history = recent.filter(active);

  // 1. Repeat party on the same day.
  const party = confirmed.merchantOrCustomer?.trim();
  if (party && confirmed.transactionDate) {
    const sameDayWithParty = history.filter(
      (item) =>
        item.transactionDate === confirmed.transactionDate &&
        item.merchantOrCustomer?.trim().toLocaleLowerCase() === party.toLocaleLowerCase(),
    );
    if (sameDayWithParty.length >= 2) {
      return ms
        ? `📌 Itu transaksi ke-${sameDayWithParty.length} dengan ${party} hari ini.`
        : `📌 That's your ${ordinal(sameDayWithParty.length)} transaction with ${party} today.`;
    }
  }

  // 2. Running category total for the transaction's calendar month.
  const category = confirmed.category?.trim();
  const month = confirmed.transactionDate?.slice(0, 7);
  if (category && month) {
    const sameCategoryThisMonth = history.filter(
      (item) =>
        item.category?.trim().toLocaleLowerCase() === category.toLocaleLowerCase() &&
        item.type === confirmed.type &&
        item.transactionDate?.startsWith(month),
    );
    if (sameCategoryThisMonth.length >= 2) {
      const total = sameCategoryThisMonth.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      return ms
        ? `📊 Setakat bulan ini: ${myr(locale, total)} merentas ${sameCategoryThisMonth.length} catatan "${category}".`
        : `📊 So far this month: ${myr(locale, total)} across ${sameCategoryThisMonth.length} "${category}" entries.`;
    }
  }

  return null;
}

function ordinal(value: number): string {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] ?? "th");
  return `${value}${suffix}`;
}
