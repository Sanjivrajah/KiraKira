import { z } from "zod";
import { parseTransaction } from "@/repositories/local/parsers";

export const BROWSER_LOCAL_EXPORT_VERSION = 1;

export const browserLocalExportSchema = z.object({
  schemaVersion: z.literal(BROWSER_LOCAL_EXPORT_VERSION),
  exportId: z.string().uuid(),
  exportedAt: z.string().datetime(),
  records: z.array(z.unknown()).max(1_000),
}).strict();

export type BrowserLocalExport = z.infer<typeof browserLocalExportSchema>;

export type ImportableTransaction = {
  legacyId: string;
  direction: "income" | "expense";
  lifecycle: "proposed" | "review_required" | "confirmed" | "voided";
  transactionDate: string;
  description: string;
  categoryCode: string;
  currency: "MYR";
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  paymentMethodCode: string | null;
  confidenceScore: number | null;
  sourceProvenance: "manual" | "receipt" | "voice" | "csv" | "bank_statement" | "whatsapp_demo";
  occurredAt: string;
  confirmation: Record<string, unknown>;
};

export type ImportRecordPreview = {
  index: number;
  legacyId: string | null;
  status: "ready" | "invalid";
  error?: string;
  transaction?: ImportableTransaction;
};

function toMinor(value: number): number {
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Amounts must be non-negative MYR values within the supported range.");
  return result;
}

export function previewBrowserLocalExport(input: unknown): { exportData: BrowserLocalExport; records: ImportRecordPreview[] } {
  const exportData = browserLocalExportSchema.parse(input);
  return {
    exportData,
    records: exportData.records.map((raw, index) => {
      const transaction = parseTransaction(raw);
      const legacyId = raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : null;
      if (!transaction) return { index, legacyId, status: "invalid", error: "Record does not match the supported browser-local transaction format." };
      try {
        const lifecycle = transaction.status === "draft" ? "proposed" : transaction.status === "needs_review" ? "review_required" : transaction.status === "confirmed" ? "confirmed" : "voided";
        return {
          index,
          legacyId: transaction.id,
          status: "ready",
          transaction: {
            legacyId: transaction.id,
            direction: transaction.type,
            lifecycle,
            transactionDate: transaction.date,
            description: transaction.description,
            categoryCode: transaction.category,
            currency: "MYR",
            subtotalMinor: toMinor(transaction.subtotal),
            taxMinor: toMinor(transaction.tax),
            totalMinor: toMinor(transaction.total),
            paymentMethodCode: transaction.paymentMethod ?? null,
            confidenceScore: transaction.confidenceScore ?? null,
            sourceProvenance: transaction.sourceType === "whatsapp" ? "whatsapp_demo" : transaction.sourceType,
            occurredAt: transaction.createdAt,
            confirmation: { import: { source: "browser_local", legacyId: transaction.id, legacyBusinessId: transaction.businessId, exportedAt: exportData.exportedAt } },
          },
        };
      } catch (error) {
        return { index, legacyId: transaction.id, status: "invalid", error: error instanceof Error ? error.message : "Record could not be mapped." };
      }
    }),
  };
}
