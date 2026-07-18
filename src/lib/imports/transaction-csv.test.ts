import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTransactionCsv } from "./transaction-csv";

describe("parseTransactionCsv", () => {
  it("keeps the downloadable six-month sample compatible with the importer", () => {
    const sample = readFileSync("public/samples/niaga-transaction-import-sample.csv", "utf8");
    const result = parseTransactionCsv(sample, "csv");
    const monthlyCounts = result.drafts.reduce<Record<string, { income: number; expense: number }>>((counts, draft) => {
      const month = draft.date.slice(0, 7);
      counts[month] ??= { income: 0, expense: 0 };
      counts[month][draft.type] += 1;
      return counts;
    }, {});

    expect(result.failures).toEqual([]);
    expect(result.drafts).toHaveLength(36);
    expect(Object.keys(monthlyCounts)).toHaveLength(6);
    expect(Object.values(monthlyCounts)).toEqual(Array.from({ length: 6 }, () => ({ income: 3, expense: 3 })));
  });

  it("parses a generic transaction CSV with quoted values", () => {
    const result = parseTransactionCsv(
      'Date,Type,Amount,Description,Counterparty,Category\n14/07/2026,expense,"1,240.50","Stock, drinks",Maju Mart,Inventory',
      "csv",
    );

    expect(result).toEqual({
      drafts: [{
        type: "expense",
        date: "2026-07-14",
        amount: 1240.5,
        category: "Inventory",
        description: "Stock, drinks",
        counterpartyName: "Maju Mart",
        paymentMethod: "",
        source: "csv",
      }],
      failures: [],
      truncated: false,
    });
  });

  it("maps bank debit and credit columns without using AI", () => {
    const result = parseTransactionCsv(
      "Transaction Date,Transaction Description,Debit Amount,Credit Amount\n2026-07-12,DUITNOW PAYMENT,50.00,\n2026-07-13,SALES SETTLEMENT,,620.00",
      "bank_statement",
    );

    expect(result.drafts).toMatchObject([
      { type: "expense", amount: 50, source: "bank_statement" },
      { type: "income", amount: 620, source: "bank_statement" },
    ]);
    expect(result.failures).toEqual([]);
  });

  it("reports invalid rows while preserving valid transactions", () => {
    const result = parseTransactionCsv(
      "Date,Amount,Description\nnot-a-date,20,Bad row\n2026-07-14,-30,Valid expense",
      "csv",
    );

    expect(result.drafts).toMatchObject([{ type: "expense", amount: 30, description: "Valid expense" }]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("Row 2");
  });

  it("requires recognisable date and amount columns", () => {
    const result = parseTransactionCsv("When,Value-ish\nToday,20", "csv");
    expect(result.drafts).toEqual([]);
    expect(result.failures[0]).toContain("date column");
  });

  it("does not guess the direction of an unsigned amount", () => {
    const result = parseTransactionCsv("Date,Amount,Description\n2026-07-14,20,Ambiguous", "csv");
    expect(result.drafts).toEqual([]);
    expect(result.failures[0]).toContain("Type column");
  });
});
