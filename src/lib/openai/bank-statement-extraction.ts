import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { bankStatementExtractionSchema, type BankStatementExtraction } from "./bank-statement-schema";

const BANK_STATEMENT_PROMPT = `Extract individual transactions from this Malaysian bank statement for owner review.

Rules:
- Return at most 100 posted transactions in statement order.
- Include only rows with a complete visible transaction date and a non-zero visible amount.
- Exclude opening balances, closing balances, running balances, subtotals, totals, pending rows, and page headers.
- Mark deposits, credits, and money received as income. Mark withdrawals, debits, charges, and money paid as expense.
- Amount must be positive. Type carries the direction.
- Use YYYY-MM-DD dates. Resolve a missing year only when the statement period visibly supplies that year; otherwise omit the row.
- Use MYR only when RM, MYR, or a Malaysian-ringgit statement context is visible. Otherwise preserve the visible currency code.
- Copy the visible transaction wording into description. Do not invent a merchant or payment method.
- Use an empty string when counterparty or payment method is not visible.
- Evidence is a short visible fragment supporting the row. Never include account numbers in evidence.
- Add a warning when rows are unreadable, truncated, or intentionally omitted. Never repair ambiguous values.`;

let openAIClient: OpenAI | undefined;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new BankStatementExtractionConfigurationError("OPENAI_API_KEY is not configured.");
  openAIClient ??= new OpenAI({ apiKey });
  return openAIClient;
}

export class BankStatementExtractionConfigurationError extends Error {}

export async function extractBankStatementFromPdf({
  bytes,
  filename,
}: {
  bytes: Uint8Array;
  filename: string;
}): Promise<BankStatementExtraction> {
  const fileData = `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
  const response = await getOpenAIClient().responses.parse({
    model: process.env.OPENAI_DOCUMENT_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-5.4",
    store: false,
    input: [{
      role: "user",
      content: [
        { type: "input_file", filename, file_data: fileData, detail: "high" },
        { type: "input_text", text: BANK_STATEMENT_PROMPT },
      ],
    }],
    text: {
      format: zodTextFormat(bankStatementExtractionSchema, "bank_statement_extraction"),
    },
  });

  if (!response.output_parsed) throw new Error("The model did not return a bank statement extraction.");
  return bankStatementExtractionSchema.parse(response.output_parsed);
}
