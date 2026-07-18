import { describe, expect, it, vi } from "vitest";
import {
  buildTransactionExtractionPrompt,
  buildTransactionReExtractionPrompt,
  extractTransactionFromText,
  getKualaLumpurDate,
  TransactionExtractionError,
  type TransactionExtractionClient,
} from "@/features/transaction-agent/transaction-extractor";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const completeDraft: TransactionExtraction = {
  type: "expense",
  amount: 85,
  currency: "MYR",
  description: "Purchase of chicken",
  merchantOrCustomer: "Pasar Borong",
  paymentMethod: "cash",
  transactionDate: "2026-07-14",
  category: "Raw materials",
  quantity: null,
  unit: null,
  missingFields: [],
  confidence: 0.94,
};

function mockClient(outputParsed: unknown): { client: TransactionExtractionClient; parse: ReturnType<typeof vi.fn> } {
  const parse = vi.fn().mockResolvedValue({ output_parsed: outputParsed });
  return { client: { responses: { parse } } as unknown as TransactionExtractionClient, parse };
}

describe("transaction text extractor", () => {
  it("passes the model a Kuala Lumpur date and returns its validated structured draft", async () => {
    const { client, parse } = mockClient(completeDraft);
    const now = new Date("2026-07-14T20:30:00.000Z");

    await expect(extractTransactionFromText({
      input: "Semalam beli ayam RM85 cash dekat Pasar Borong",
      apiKey: "test-key",
      model: "gpt-4o-mini",
      client,
      now,
    })).resolves.toEqual(completeDraft);

    expect(parse).toHaveBeenCalledOnce();
    expect(parse.mock.calls[0]?.[0].model).toBe("gpt-4o-mini");
    expect(parse.mock.calls[0]?.[0].input[0].content[0].text).toContain("Current local date in Asia/Kuala_Lumpur: 2026-07-15");
  });

  it("accepts a deliberately incomplete draft instead of inventing details", async () => {
    const { client } = mockClient({
      type: "expense", amount: 300, currency: "MYR", description: "", merchantOrCustomer: "Ali",
      paymentMethod: "unknown", transactionDate: null, category: null, quantity: null, unit: null,
      missingFields: ["purpose", "transactionDate", "paymentMethod"], confidence: 0.55,
    });

    await expect(extractTransactionFromText({ input: "Paid supplier Ali RM300", apiKey: "test-key", model: "gpt-4o-mini", client }))
      .resolves.toMatchObject({ amount: 300, transactionDate: null, paymentMethod: "unknown", missingFields: ["purpose", "transactionDate", "paymentMethod"] });
  });

  it("rejects malformed model output without exposing the provider error", async () => {
    const { client } = mockClient({ ...completeDraft, confidence: 1.2 });

    await expect(extractTransactionFromText({ input: "Sold food", apiKey: "test-key", model: "gpt-4o-mini", client }))
      .rejects.toBeInstanceOf(TransactionExtractionError);
  });

  it("uses Asia/Kuala_Lumpur rather than the machine timezone", () => {
    expect(getKualaLumpurDate(new Date("2026-07-14T20:30:00.000Z"))).toBe("2026-07-15");
  });

  it("includes earlier replies in the re-extraction prompt so references resolve across turns", () => {
    const prompt = buildTransactionReExtractionPrompt({ originalInput: "Beli barang", currentDraft: completeDraft, requestedField: "amount", reply: "make it 55 instead", currentDate: "2026-07-15", history: ["at Pasar Borong", "cash"] });
    expect(prompt).toContain("Earlier replies in this conversation");
    expect(prompt).toContain("1. at Pasar Borong");
    expect(prompt).toContain("2. cash");
    expect(prompt).toContain("make it 55 instead");
  });

  it("omits the conversation section when there is no prior history", () => {
    const prompt = buildTransactionReExtractionPrompt({ originalInput: "Beli barang", currentDraft: completeDraft, requestedField: "amount", reply: "RM55", currentDate: "2026-07-15" });
    expect(prompt).not.toContain("Earlier replies in this conversation");
  });

  it("gives the model the multilingual and anti-invention rules", () => {
    const prompt = buildTransactionExtractionPrompt({ input: "hari ini jual kuih", currentDate: "2026-07-15" });
    expect(prompt).toContain("Bahasa Melayu, Manglish");
    expect(prompt).toContain("Never invent amounts, dates, payment methods, merchants, customers, or purposes.");
    expect(prompt).toContain("semalam/yesterday");
    expect(prompt).toContain('description "Purchase of chicken", category "Raw materials"');
    expect(prompt).toContain('description "Sale of nasi lemak", category "Sales revenue"');
    expect(prompt).toContain("do not invent the purpose or category");
  });
});
