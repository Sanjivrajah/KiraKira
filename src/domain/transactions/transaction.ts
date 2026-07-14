import type {
  AuditableEntity,
  BusinessId,
  CurrencyCode,
  DecimalString,
  ISODate,
  ISODateTime,
  PartyId,
  TransactionId,
  UserId,
} from "../common";
import type { TransactionLine } from "./transaction-line";
import type { TransactionSourceLink } from "./transaction-source-link";
import type { TransactionTotals } from "./transaction-totals";

export type TransactionDirection = "income" | "expense";
export type TransactionLifecycle = "proposed" | "review_required" | "confirmed" | "voided";
export type TransactionPaymentStatus = "unpaid" | "partially_paid" | "paid" | "not_applicable" | "unknown";
export type EInvoiceTreatment =
  | "individual"
  | "consolidated_candidate"
  | "self_billed_candidate"
  | "not_required"
  | "undetermined";

export interface TransactionConfirmationMetadata {
  confirmedBy: UserId;
  confirmedAt: ISODateTime;
  notes?: string;
}

export interface TransactionVoidMetadata {
  voidedBy: UserId;
  voidedAt: ISODateTime;
  reason: string;
}

export interface FinancialTransaction extends Omit<AuditableEntity, "id"> {
  id: TransactionId;
  businessId: BusinessId;
  direction: TransactionDirection;
  lifecycle: TransactionLifecycle;
  transactionDate: ISODate;
  accountingDate: ISODate;
  counterpartyId?: PartyId;
  /** Non-authoritative display snapshot retained for gradual migration. */
  counterpartyNameSnapshot?: string;
  sourceLinks: TransactionSourceLink[];
  description: string;
  categoryCode: string;
  currency: CurrencyCode;
  exchangeRateToMYR?: DecimalString;
  lines: TransactionLine[];
  totals: TransactionTotals;
  paymentStatus: TransactionPaymentStatus;
  paymentMethodCode?: string;
  eInvoiceTreatment: EInvoiceTreatment;
  confidenceScore?: number;
  confirmation?: TransactionConfirmationMetadata;
  voidMetadata?: TransactionVoidMetadata;
}
