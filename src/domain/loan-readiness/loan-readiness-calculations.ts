import type { LoanTerms, ReadinessDebt, ReadinessTransaction } from "./loan-readiness.schema";

const EXCLUDED_CATEGORY_TERMS = ["transfer", "loan", "financing", "owner", "capital", "refund", "draw"];
const MONTHS_REQUIRED = 6;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthIndex(month: string) {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value;
}

function hasConsecutiveHistory(months: string[]) {
  if (months.length < MONTHS_REQUIRED) return false;
  let run = 1;
  for (let index = 1; index < months.length; index += 1) {
    run = monthIndex(months[index]) === monthIndex(months[index - 1]) + 1 ? run + 1 : 1;
    if (run >= MONTHS_REQUIRED) return true;
  }
  return false;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function conservativeCashFlow(values: number[]) {
  const trailingSix = values.slice(-6);
  const candidates = [average(trailingSix)];
  if (trailingSix.length >= 3) candidates.push(average(trailingSix.slice(-3)));
  return Math.min(...candidates);
}

function isOperating(transaction: ReadinessTransaction) {
  return !EXCLUDED_CATEGORY_TERMS.some((term) => transaction.categoryCode.toLowerCase().includes(term));
}

export function monthlyInstalment({ principal, annualRatePercent, tenureMonths }: LoanTerms) {
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return roundMoney(principal / tenureMonths);
  const factor = (1 + monthlyRate) ** tenureMonths;
  return roundMoney(principal * monthlyRate * factor / (factor - 1));
}

export function principalForPayment(payment: number, annualRatePercent: number, tenureMonths: number) {
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return roundMoney(payment * tenureMonths);
  const factor = (1 + monthlyRate) ** tenureMonths;
  return roundMoney(payment * (factor - 1) / (monthlyRate * factor));
}

export function inferRecurringDebts(transactions: ReadinessTransaction[]): ReadinessDebt[] {
  const groups = new Map<string, ReadinessTransaction[]>();
  for (const transaction of transactions) {
    if (transaction.lifecycle !== "confirmed" || transaction.direction !== "expense") continue;
    const category = transaction.categoryCode.toLowerCase();
    if (!category.includes("loan") && !category.includes("repay") && !category.includes("finance")) continue;
    const key = category;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return [...groups.entries()].flatMap(([key, values]) => {
    const recent = values.toSorted((a, b) => a.date.localeCompare(b.date)).slice(-6);
    if (recent.length < 3) return [];
    const amounts = recent.map((item) => item.amount).toSorted((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const withinRange = recent.filter((item) => Math.abs(item.amount - median) / median <= 0.1);
    if (withinRange.length < 3) return [];
    return [{ id: `inferred:${key}`, monthlyRepayment: roundMoney(median), confidence: 0.9, sourceTransactionIds: withinRange.map((item) => item.id) }];
  });
}

export function assessReadiness({ transactions, debts, terms }: {
  transactions: ReadinessTransaction[];
  debts?: ReadinessDebt[];
  terms?: LoanTerms;
}) {
  const confirmed = transactions.filter((item) => item.lifecycle === "confirmed");
  const months = [...new Set(confirmed.map((item) => monthKey(item.date)))].toSorted().slice(-12);
  const operating = confirmed.filter(isOperating);
  const monthly = new Map(months.map((month) => [month, { inflows: 0, outflows: 0 }]));
  for (const transaction of operating) {
    const key = monthKey(transaction.date);
    if (!monthly.has(key)) continue;
    const value = monthly.get(key) ?? { inflows: 0, outflows: 0 };
    if (transaction.direction === "income") value.inflows += transaction.amount;
    else value.outflows += transaction.amount;
    monthly.set(key, value);
  }
  const cfads = [...monthly.entries()].map(([month, values]) => ({ month, ...values, value: roundMoney(values.inflows - values.outflows) })).toSorted((a, b) => a.month.localeCompare(b.month));
  const averageCfads = roundMoney(average(cfads.map((item) => item.value)));
  const coverage = transactions.length ? confirmed.length / transactions.length : 0;
  const inferredDebts = debts ?? inferRecurringDebts(transactions);
  const existingDebtService = roundMoney(inferredDebts.reduce((sum, item) => sum + item.monthlyRepayment, 0));
  const proposedInstalment = terms ? monthlyInstalment(terms) : 0;
  const totalDebtService = existingDebtService + proposedInstalment;
  const conservativeCfads = roundMoney(conservativeCashFlow(cfads.map((item) => item.value)));
  const dscr = totalDebtService > 0 ? conservativeCfads / totalDebtService : null;
  const scenarioDscr = (inflowFactor: number, outflowFactor: number) => {
    if (totalDebtService <= 0) return null;
    const scenarioCfads = cfads.map((item) => item.inflows * inflowFactor - item.outflows * outflowFactor);
    const conservative = conservativeCashFlow(scenarioCfads);
    return conservative / totalDebtService;
  };
  const maximumMonthlyRepayment = roundMoney(Math.max(0, conservativeCfads / 1.25 - existingDebtService));
  const potentialLoanAmount = principalForPayment(maximumMonthlyRepayment, 8, 36);
  const dataIssues = [
    ...(!hasConsecutiveHistory(months) ? ["At least six consecutive completed months of confirmed records are needed."] : []),
    ...(coverage < 0.8 ? ["Less than 80% of recorded transactions are confirmed."] : []),
  ];
  const status = dataIssues.length > 0 ? "insufficient_data"
    : dscr === null ? "needs_review"
      : dscr < 1 ? "not_ready"
        : dscr < 1.25 ? "borderline"
          : dscr < 1.5 ? "ready" : "strong";
  return {
    status,
    assessmentMonths: months.length,
    confirmedCoverage: coverage,
    averageMonthlyCfads: averageCfads,
    existingDebtService,
    proposedInstalment,
    totalDebtService,
    dscr,
    maximumMonthlyRepayment,
    potentialLoanAmount,
    potentialLoanAssumptions: { annualRatePercent: 8, tenureMonths: 36 },
    scenarios: {
      baseDscr: dscr,
      cautiousDscr: scenarioDscr(0.9, 1.05),
      stressedDscr: scenarioDscr(0.75, 1.1),
    },
    inferredDebts,
    monthlyCfads: cfads.map(({ month, value }) => ({ month, value })),
    dataIssues,
    disclaimer: "Indicative cash-flow assessment only. It is not a lender decision, financing offer, credit score, or financial advice.",
  } as const;
}

export type LoanReadinessResult = ReturnType<typeof assessReadiness>;
