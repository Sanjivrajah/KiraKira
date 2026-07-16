import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { Database, Json } from "@/lib/supabase/database.types";
import { financialTransactionSchema } from "@/domain/transactions/transaction.schema";
import type { z } from "zod";
import { RepositoryError } from "@/repositories/contracts";

export type FinancialTransaction = z.infer<typeof financialTransactionSchema>;
export type NewFinancialTransaction = Omit<FinancialTransaction, "id"> & { id?: string };

export type TransactionPage = { items: FinancialTransaction[]; nextCursor: string | null };
export type TransactionListOptions = {
  cursor?: string;
  limit?: number;
  lifecycle?: FinancialTransaction["lifecycle"];
  direction?: FinancialTransaction["direction"];
  search?: string;
};

const transactionColumns = "id,business_id,direction,lifecycle,transaction_date,accounting_date,counterparty_id,counterparty_name_snapshot,source_links,description,category_code,currency,exchange_rate_to_myr,subtotal_minor,discount_minor,tax_minor,total_minor,lines,totals,payment_status,payment_method_code,e_invoice_treatment,confidence_score,confirmation,void_metadata,created_at,updated_at,created_by,updated_by,version";
type TransactionRow = Pick<Database["public"]["Tables"]["transactions"]["Row"],
  "id" | "business_id" | "direction" | "lifecycle" | "transaction_date" | "accounting_date" |
  "counterparty_id" | "counterparty_name_snapshot" | "source_links" | "description" | "category_code" |
  "currency" | "exchange_rate_to_myr" | "subtotal_minor" | "discount_minor" | "tax_minor" | "total_minor" | "lines" | "totals" | "payment_status" |
  "payment_method_code" | "e_invoice_treatment" | "confidence_score" | "confirmation" |
  "void_metadata" | "created_at" | "updated_at" | "created_by" | "updated_by" | "version"
>;

type SupabaseRepositoryFailure = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message: string;
};

function toRepositoryError(error: SupabaseRepositoryFailure, operation: "read" | "write") {
  // Keep the customer-facing message safe, but make local development failures
  // diagnosable without logging transaction values or authentication tokens.
  if (process.env.NODE_ENV !== "production") {
    console.warn("[transactions] Supabase request failed", {
      code: error.code ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      message: error.message,
      operation,
    });
  }
  if (error.code === "PGRST116") return new RepositoryError("The requested transaction was not found.", "NOT_FOUND");
  if (error.code === "42501" || error.code === "PGRST301") return new RepositoryError("You do not have permission to access this business.", "FORBIDDEN");
  if (error.code === "23505") return new RepositoryError("This transaction was already saved.", "CONFLICT");
  return new RepositoryError(operation === "read" ? "We could not load transactions. Please try again." : "We could not save this transaction. Please try again.", operation === "read" ? "READ_FAILED" : "WRITE_FAILED", { cause: error });
}

function toMinorUnits(value: string) {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new RepositoryError("The transaction amount is invalid.", "INVALID_DATA");
  const fraction = match[2] ?? "";
  let minor = BigInt(match[1]) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
  if (Number(fraction[2] ?? "0") >= 5) minor += BigInt(1);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new RepositoryError("The transaction amount is outside the supported range.", "INVALID_DATA");
  return Number(minor);
}

function normalizedAmounts(transaction: Pick<FinancialTransaction, "totals">) {
  const totalMinor = toMinorUnits(transaction.totals.payableAmount.amount);
  const discountMinor = toMinorUnits(transaction.totals.allowanceTotal.amount);
  const taxMinor = toMinorUnits(transaction.totals.taxTotal.amount);
  // The current database constraint is total = subtotal - discount + tax.
  // Deriving subtotal from the canonical payable amount also supports records
  // with charges or rounding until those columns are normalized separately.
  return { subtotalMinor: totalMinor + discountMinor - taxMinor, discountMinor, taxMinor, totalMinor };
}

export class SupabaseTransactionRepository {
  private get client() {
    return getSupabaseBrowserClient();
  }

  async listPage(businessId: string, options: TransactionListOptions = {}): Promise<TransactionPage> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    let query = this.client
      .from("transactions")
      .select(transactionColumns)
      .eq("business_id", businessId)
      .order("transaction_date", { ascending: false });
    if (options.lifecycle) query = query.eq("lifecycle", options.lifecycle);
    if (options.direction) query = query.eq("direction", options.direction);
    if (options.search?.trim()) query = query.ilike("description", `%${options.search.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    if (options.cursor) query = query.lt("transaction_date", options.cursor);
    const { data, error } = await query.limit(limit + 1);

    if (error) throw toRepositoryError(error, "read");
    const rows = data ?? [];
    const items = rows.slice(0, limit).map((row) => this.mapFromDatabase(row));
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.transactionDate ?? null : null };
  }

  async list(businessId: string): Promise<FinancialTransaction[]> {
    const page = await this.listPage(businessId, { limit: 100 });
    return page.items;
  }

  async getById(businessId: string, transactionId: string): Promise<FinancialTransaction | null> {
    const { data, error } = await this.client
      .from("transactions")
      .select(transactionColumns)
      .eq("business_id", businessId)
      .eq("id", transactionId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw toRepositoryError(error, "read");
    }

    return this.mapFromDatabase(data);
  }

  async create(transaction: NewFinancialTransaction): Promise<FinancialTransaction> {
    const { data, error } = await this.client
      .from("transactions")
      .insert([this.mapToDatabase(transaction)])
      .select(transactionColumns)
      .single();

    if (error) throw toRepositoryError(error, "write");
    return this.mapFromDatabase(data);
  }

  async update(businessId: string, transactionId: string, changes: Partial<FinancialTransaction>): Promise<FinancialTransaction> {
    // Only map the changes provided
    const dbChanges: Record<string, unknown> = {};
    if (changes.direction) dbChanges.direction = changes.direction;
    if (changes.lifecycle) dbChanges.lifecycle = changes.lifecycle;
    if (changes.transactionDate) dbChanges.transaction_date = changes.transactionDate;
    if (changes.accountingDate) dbChanges.accounting_date = changes.accountingDate;
    if (changes.counterpartyId !== undefined) dbChanges.counterparty_id = changes.counterpartyId;
    if (changes.counterpartyNameSnapshot !== undefined) dbChanges.counterparty_name_snapshot = changes.counterpartyNameSnapshot;
    if (changes.sourceLinks) dbChanges.source_links = changes.sourceLinks;
    if (changes.description) dbChanges.description = changes.description;
    if (changes.categoryCode) dbChanges.category_code = changes.categoryCode;
    if (changes.currency) dbChanges.currency = changes.currency;
    if (changes.exchangeRateToMYR !== undefined) dbChanges.exchange_rate_to_myr = changes.exchangeRateToMYR;
    if (changes.lines) dbChanges.lines = changes.lines;
    if (changes.totals) dbChanges.totals = changes.totals;
    if (changes.totals) {
      const amounts = normalizedAmounts({ ...changes, totals: changes.totals } as FinancialTransaction);
      dbChanges.subtotal_minor = amounts.subtotalMinor;
      dbChanges.discount_minor = amounts.discountMinor;
      dbChanges.tax_minor = amounts.taxMinor;
      dbChanges.total_minor = amounts.totalMinor;
    }
    if (changes.paymentStatus) dbChanges.payment_status = changes.paymentStatus;
    if (changes.paymentMethodCode !== undefined) dbChanges.payment_method_code = changes.paymentMethodCode;
    if (changes.eInvoiceTreatment) dbChanges.e_invoice_treatment = changes.eInvoiceTreatment;
    if (changes.confidenceScore !== undefined) dbChanges.confidence_score = changes.confidenceScore;
    if (changes.confirmation !== undefined) dbChanges.confirmation = changes.confirmation;
    if (changes.voidMetadata !== undefined) dbChanges.void_metadata = changes.voidMetadata;
    if (changes.updatedAt) dbChanges.updated_at = changes.updatedAt;
    if (changes.updatedBy !== undefined) dbChanges.updated_by = changes.updatedBy;
    if (changes.version !== undefined) dbChanges.version = changes.version;

    const { data, error } = await this.client
      .from("transactions")
      .update(dbChanges)
      .eq("business_id", businessId)
      .eq("id", transactionId)
      .select(transactionColumns)
      .single();

    if (error) throw toRepositoryError(error, "write");
    return this.mapFromDatabase(data);
  }

  async void(businessId: string, transactionId: string, reason: string): Promise<FinancialTransaction> {
    const { data, error } = await this.client
      .from("transactions")
      .update({ lifecycle: "voided", voided_at: new Date().toISOString(), void_reason: reason })
      .eq("business_id", businessId)
      .eq("id", transactionId)
      .select(transactionColumns)
      .single();

    if (error) throw toRepositoryError(error, "write");
    return this.mapFromDatabase(data);
  }

  // Maps database snake_case row to camelCase domain model
  mapFromDatabase(row: TransactionRow): FinancialTransaction {
    // Helper to strip nulls
    const notNull = (value: unknown) => (value === null ? undefined : value);

    const obj = {
      id: row.id,
      businessId: row.business_id,
      direction: row.direction,
      lifecycle: row.lifecycle,
      transactionDate: row.transaction_date,
      accountingDate: row.accounting_date,
      counterpartyId: notNull(row.counterparty_id),
      counterpartyNameSnapshot: notNull(row.counterparty_name_snapshot),
      sourceLinks: row.source_links || [],
      description: row.description,
      categoryCode: row.category_code,
      currency: row.currency,
      exchangeRateToMYR: notNull(row.exchange_rate_to_myr)?.toString(),
      lines: row.lines,
      totals: row.totals,
      paymentStatus: row.payment_status,
      paymentMethodCode: notNull(row.payment_method_code),
      eInvoiceTreatment: row.e_invoice_treatment,
      confidenceScore: notNull(row.confidence_score),
      confirmation: notNull(row.confirmation),
      voidMetadata: notNull(row.void_metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: notNull(row.created_by),
      updatedBy: notNull(row.updated_by),
      version: notNull(row.version),
    };
    return financialTransactionSchema.parse(obj);
  }

  // Maps camelCase domain model to database snake_case row
  mapToDatabase(txn: NewFinancialTransaction | FinancialTransaction): Database["public"]["Tables"]["transactions"]["Insert"] {
    const amounts = normalizedAmounts(txn);
    const row: Database["public"]["Tables"]["transactions"]["Insert"] = {
      business_id: txn.businessId,
      direction: txn.direction,
      lifecycle: txn.lifecycle,
      transaction_date: txn.transactionDate,
      accounting_date: txn.accountingDate,
      counterparty_id: txn.counterpartyId,
      counterparty_name_snapshot: txn.counterpartyNameSnapshot,
      source_links: txn.sourceLinks as Json,
      description: txn.description,
      category_code: txn.categoryCode,
      currency: txn.currency,
      exchange_rate_to_myr: txn.exchangeRateToMYR ? Number(txn.exchangeRateToMYR) : undefined,
      subtotal_minor: amounts.subtotalMinor,
      discount_minor: amounts.discountMinor,
      tax_minor: amounts.taxMinor,
      total_minor: amounts.totalMinor,
      lines: txn.lines as Json,
      totals: txn.totals as Json,
      payment_status: txn.paymentStatus,
      payment_method_code: txn.paymentMethodCode,
      e_invoice_treatment: txn.eInvoiceTreatment,
      confidence_score: txn.confidenceScore,
      confirmation: txn.confirmation as Json | undefined,
      void_metadata: txn.voidMetadata as Json | undefined,
      created_at: txn.createdAt,
      updated_at: txn.updatedAt,
      created_by: txn.createdBy,
      updated_by: txn.updatedBy,
    };
    // PostgREST serializes explicit `undefined` values as SQL NULL. Omit
    // server-generated fields so PostgreSQL can apply their column defaults.
    return {
      ...row,
      ...(txn.id ? { id: txn.id } : {}),
      ...(txn.version !== undefined ? { version: txn.version } : {}),
    };
  }
}
