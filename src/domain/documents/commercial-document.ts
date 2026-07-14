import type {
  AuditableEntity,
  BusinessId,
  CurrencyCode,
  DecimalString,
  DocumentId,
  ISODate,
  LocalTime,
  MoneyValue,
  PartyId,
  TransactionId,
} from "../common";
import type { AllowanceCharge } from "./allowance-charge";
import type { DocumentLine } from "./document-line";
import type { DocumentReference } from "./document-reference";
import type { DocumentTaxTotal } from "./tax-total";

export type CommercialDocumentType =
  | "invoice"
  | "credit_note"
  | "debit_note"
  | "refund_note"
  | "self_billed_invoice"
  | "self_billed_credit_note"
  | "self_billed_debit_note"
  | "self_billed_refund_note";

export type CommercialDocumentStatus =
  | "draft"
  | "ready_for_validation"
  | "ready_for_submission"
  | "submitted"
  | "valid"
  | "invalid"
  | "cancelled"
  | "rejected";

export interface PaymentInstructions {
  paymentModeCode: string;
  bankAccountIdentifier?: string;
  paymentTerms?: string;
  dueDate?: ISODate;
  paymentReference?: string;
}

export interface BillingPeriod {
  startDate: ISODate;
  endDate: ISODate;
}

export interface DocumentMonetaryTotals {
  lineExtensionAmount: MoneyValue;
  allowanceTotal: MoneyValue;
  chargeTotal: MoneyValue;
  taxExclusiveAmount: MoneyValue;
  taxTotal: MoneyValue;
  taxInclusiveAmount: MoneyValue;
  prepaidAmount: MoneyValue;
  roundingAmount: MoneyValue;
  payableAmount: MoneyValue;
}

export interface CommercialDocument extends Omit<AuditableEntity, "id"> {
  id: DocumentId;
  businessId: BusinessId;
  documentType: CommercialDocumentType;
  internalDocumentNumber: string;
  issueDate: ISODate;
  issueTime: LocalTime;
  supplierPartyId: PartyId;
  buyerPartyId: PartyId;
  shippingRecipientPartyId?: PartyId;
  sourceTransactionIds: TransactionId[];
  currency: CurrencyCode;
  taxCurrency?: CurrencyCode;
  exchangeRate?: DecimalString;
  lines: DocumentLine[];
  allowances: AllowanceCharge[];
  charges: AllowanceCharge[];
  taxTotals: DocumentTaxTotal[];
  monetaryTotals: DocumentMonetaryTotals;
  paymentInstructions?: PaymentInstructions;
  billingPeriod?: BillingPeriod;
  references: DocumentReference[];
  invoicePurpose?: string;
  notes: string[];
  status: CommercialDocumentStatus;
}
