import { INVOICE_V1_0_FIELD_REGISTRY, type InvoiceFieldDefinition } from "@/compliance/myinvois";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

export type AgentLocale = "en" | "ms";

export type EInvoiceReadinessHint = {
  /** Only a sale (income) can become a MyInvois e-Invoice, so the hint applies to those. */
  applicable: boolean;
  /** Capture-stage essentials the draft already provides. */
  have: string[];
  /** MyInvois-mandatory fields still required before an e-Invoice can be issued. */
  needs: { label: string; guideline?: number }[];
};

/** MyInvois fields that cannot be captured from a plain Telegram sale and must be added later. */
const REQUIRED_KEYS = ["buyer.tin", "line.classification"] as const;

/**
 * A truthful, advisory assessment of how close a captured sale is to being a MyInvois
 * e-Invoice. It never maps or submits a provider payload — it only reflects the lightweight
 * draft against the real field registry so the owner knows what the workspace will still ask for.
 */
export function assessEInvoiceReadiness(draft: TransactionExtraction): EInvoiceReadinessHint {
  if (draft.type !== "income") return { applicable: false, have: [], needs: [] };

  const have: string[] = [];
  if (draft.amount) have.push("amount");
  if (draft.transactionDate) have.push("date");
  if (draft.description) have.push("description");
  if (draft.merchantOrCustomer) have.push("customer");

  const needs = REQUIRED_KEYS
    .map((key) => INVOICE_V1_0_FIELD_REGISTRY.find((definition) => definition.key === key))
    .filter((definition): definition is InvoiceFieldDefinition => Boolean(definition))
    .map((definition) => ({ label: definition.label, ...(definition.guidelineNumber ? { guideline: definition.guidelineNumber } : {}) }));

  if (!draft.merchantOrCustomer) needs.unshift({ label: "Buyer's name" });

  return { applicable: true, have, needs };
}

/** Compact, advisory review-card line. Returns null when no hint applies. */
export function formatEInvoiceHint(draft: TransactionExtraction, locale: AgentLocale = "en"): string | null {
  const hint = assessEInvoiceReadiness(draft);
  if (!hint.applicable) return null;
  const ms = locale === "ms";
  if (hint.needs.length === 0) {
    return ms
      ? "🧾 e-Invois: butiran tangkapan lengkap. Anda boleh sediakan e-Invois MyInvois untuk jualan ini dalam ruang kerja (bukan penghantaran)."
      : "🧾 e-Invoice: capture details look complete. You can prepare a MyInvois e-Invoice for this sale in the workspace (this is not a submission).";
  }
  const list = hint.needs.map((need) => (need.guideline ? `${need.label} (g${need.guideline})` : need.label)).join(", ");
  return ms
    ? `🧾 e-Invois: jualan ini boleh jadi e-Invois MyInvois. Anda masih perlukan ${list} dalam ruang kerja. Ini panduan sahaja, bukan penghantaran.`
    : `🧾 e-Invoice: this sale can become a MyInvois e-Invoice. You'll still need ${list} in the workspace. This is guidance only, not a submission.`;
}
