import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  BankStatementExtractionConfigurationError,
  extractBankStatementFromPdf,
} from "@/lib/openai/bank-statement-extraction";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null
    && typeof value !== "string"
    && typeof value.arrayBuffer === "function"
    && typeof value.name === "string";
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export async function POST(request: Request) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Send the statement as multipart form data." }, { status: 400 });
    }

    const statement = formData.get("statement");
    if (!isUploadedFile(statement)) {
      return NextResponse.json({ error: "Choose a PDF bank statement to continue." }, { status: 400 });
    }
    if (statement.type !== "application/pdf" && !statement.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Use a PDF statement, or import a bank CSV instead." }, { status: 415 });
    }
    if (statement.size === 0 || statement.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "Use a PDF between 1 byte and 15 MB." }, { status: 413 });
    }

    const bytes = new Uint8Array(await statement.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return NextResponse.json({ error: "This file does not appear to be a valid PDF statement." }, { status: 415 });
    }

    const extraction = await extractBankStatementFromPdf({
      bytes,
      filename: statement.name.slice(0, 120) || "bank-statement.pdf",
    });
    const drafts = extraction.transactions
      .filter((transaction) => transaction.amount > 0 && isValidIsoDate(transaction.date))
      .map((transaction) => ({
        type: transaction.type,
        date: transaction.date,
        amount: transaction.amount,
        category: transaction.type === "income" ? "Sales" : "Uncategorised",
        description: transaction.description.slice(0, 160),
        counterpartyName: transaction.counterpartyName.slice(0, 100),
        paymentMethod: transaction.paymentMethod.slice(0, 60),
        source: "bank_statement" as const,
      }));

    if (drafts.length === 0) {
      return NextResponse.json({ error: "We could not find complete transactions in this statement." }, { status: 422 });
    }
    return NextResponse.json({ drafts, warnings: extraction.warnings.map((warning) => warning.slice(0, 240)) });
  } catch (error) {
    if (error instanceof BankStatementExtractionConfigurationError) {
      return NextResponse.json({ error: "Bank statement extraction is not configured." }, { status: 503 });
    }
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI bank statement extraction failed", {
        status: error.status,
        requestId: error.requestID,
        code: error.code,
      });
      return NextResponse.json({ error: "We could not read this bank statement right now. Try again." }, { status: 502 });
    }

    console.error("Bank statement extraction failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "We could not process this bank statement." }, { status: 500 });
  }
}
