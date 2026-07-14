import type { TransactionSourceType, TransactionType } from "@/types";

const MAX_IMPORT_ROWS = 100;

type ImportSource = Extract<TransactionSourceType, "csv" | "bank_statement">;

export interface ImportedTransactionDraft {
  type: TransactionType;
  date: string;
  amount: number;
  category: string;
  description: string;
  counterpartyName: string;
  paymentMethod: string;
  source: ImportSource;
}

export interface CsvImportResult {
  drafts: ImportedTransactionDraft[];
  failures: string[];
  truncated: boolean;
}

const aliases = {
  date: ["date", "transaction date", "posting date", "value date", "tarikh"],
  description: ["description", "details", "transaction description", "narration", "particulars", "reference", "memo"],
  amount: ["amount", "transaction amount", "total", "value", "amaun"],
  debit: ["debit", "debit amount", "withdrawal", "withdrawal amount", "money out", "paid out"],
  credit: ["credit", "credit amount", "deposit", "deposit amount", "money in", "paid in"],
  type: ["type", "transaction type", "direction", "money in or out"],
  category: ["category", "expense category", "income category"],
  counterparty: ["counterparty", "merchant", "merchant name", "payee", "customer", "recipient", "beneficiary"],
  paymentMethod: ["payment method", "payment mode", "method", "channel"],
} as const;

function parseRows(input: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      if (character === "\r" && input[index + 1] === "\n") index += 1;
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function detectDelimiter(input: string) {
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, columns: parseRows(input, delimiter)[0]?.length ?? 0 }))
    .sort((left, right) => right.columns - left.columns)[0]?.delimiter ?? ",";
}

function normaliseHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findColumn(headers: string[], names: readonly string[]) {
  return headers.findIndex((header) => names.includes(header));
}

function valueAt(row: string[], index: number) {
  return index >= 0 ? (row[index] || "").trim() : "";
}

function parseMoney(raw: string) {
  if (!raw.trim()) return null;
  const parenthesised = /^\s*\(.*\)\s*$/.test(raw);
  const cleaned = raw
    .replace(/[()]/g, "")
    .replace(/\b(?:MYR|RM)\b/gi, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[^0-9.+-]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value === 0) return null;
  return parenthesised ? -Math.abs(value) : value;
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(raw: string) {
  const value = raw.trim();
  let match = value.match(/^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = value.match(/^([0-3]?\d)[-/]([01]?\d)[-/](\d{4})$/);
  if (match) return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));

  const monthNames: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  match = value.match(/^([0-3]?\d)\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (match) return isoDate(Number(match[3]), monthNames[match[2].slice(0, 3).toLowerCase()] || 0, Number(match[1]));
  return null;
}

function explicitType(raw: string): TransactionType | null {
  const value = raw.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["income", "credit", "deposit", "money in", "in", "sale", "sales"].includes(value)) return "income";
  if (["expense", "debit", "withdrawal", "money out", "out", "purchase", "spend"].includes(value)) return "expense";
  return null;
}

export function parseTransactionCsv(input: string, source: ImportSource): CsvImportResult {
  const text = input.trim();
  if (!text) return { drafts: [], failures: ["The CSV file is empty."], truncated: false };

  const rows = parseRows(text, detectDelimiter(text));
  if (rows.length < 2) return { drafts: [], failures: ["The CSV needs a header row and at least one transaction."], truncated: false };

  const headers = rows[0].map(normaliseHeader);
  const columns = Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [key, findColumn(headers, names)]),
  ) as Record<keyof typeof aliases, number>;

  if (columns.date < 0) return { drafts: [], failures: ["Add a date column, such as Date or Transaction Date."], truncated: false };
  if (columns.amount < 0 && columns.debit < 0 && columns.credit < 0) {
    return { drafts: [], failures: ["Add Amount, or separate Debit and Credit columns."], truncated: false };
  }

  const dataRows = rows.slice(1);
  const selectedRows = dataRows.slice(0, MAX_IMPORT_ROWS);
  const drafts: ImportedTransactionDraft[] = [];
  const failures: string[] = [];

  selectedRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const date = parseDate(valueAt(row, columns.date));
    if (!date) {
      failures.push(`Row ${rowNumber}: use a complete date such as 2026-07-14 or 14/07/2026.`);
      return;
    }

    const debit = parseMoney(valueAt(row, columns.debit));
    const credit = parseMoney(valueAt(row, columns.credit));
    const amountValue = parseMoney(valueAt(row, columns.amount));
    if (debit !== null && credit !== null) {
      failures.push(`Row ${rowNumber}: keep the amount in either Debit or Credit, not both.`);
      return;
    }
    const statedType = explicitType(valueAt(row, columns.type));
    if (debit === null && credit === null && statedType === null && amountValue !== null && amountValue > 0) {
      failures.push(`Row ${rowNumber}: add a Type column, or use separate Debit and Credit columns, so money in and money out are not guessed.`);
      return;
    }
    const type = debit !== null
      ? "expense"
      : credit !== null
        ? "income"
        : statedType || "expense";
    const amount = Math.abs(debit ?? credit ?? amountValue ?? 0);
    if (!amount) {
      failures.push(`Row ${rowNumber}: enter a non-zero transaction amount.`);
      return;
    }

    const counterpartyName = valueAt(row, columns.counterparty).slice(0, 100);
    const rawDescription = valueAt(row, columns.description);
    const description = (rawDescription || counterpartyName || `Imported ${type === "income" ? "income" : "expense"}`).slice(0, 160);
    const category = (valueAt(row, columns.category) || (type === "income" ? "Sales" : "Uncategorised")).slice(0, 60);

    drafts.push({
      type,
      date,
      amount,
      category,
      description,
      counterpartyName,
      paymentMethod: valueAt(row, columns.paymentMethod).slice(0, 60),
      source,
    });
  });

  return { drafts, failures, truncated: dataRows.length > MAX_IMPORT_ROWS };
}
