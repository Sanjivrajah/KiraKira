import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { financialTransactionSchema } from "@/domain/transactions/transaction.schema";
import type { z } from "zod";

export type FinancialTransaction = z.infer<typeof financialTransactionSchema>;
export type NewFinancialTransaction = Omit<FinancialTransaction, "id" | "createdAt" | "updatedAt"> & { id?: string };

export class SupabaseTransactionRepository {
  private get client() {
    return getSupabaseBrowserClient();
  }

  async list(businessId: string): Promise<FinancialTransaction[]> {
    const { data, error } = await this.client
      .from("transactions")
      .select("*")
      .eq("business_id", businessId)
      .order("transaction_date", { ascending: false });

    if (error) throw new Error(`Failed to list transactions: ${error.message}`);
    
    // We map snake_case to camelCase and validate
    return data.map(this.mapFromDatabase);
  }

  async getById(businessId: string, transactionId: string): Promise<FinancialTransaction | null> {
    const { data, error } = await this.client
      .from("transactions")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", transactionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get transaction: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  async create(transaction: FinancialTransaction): Promise<FinancialTransaction> {
    const { data, error } = await this.client
      .from("transactions")
      .insert([this.mapToDatabase(transaction)])
      .select()
      .single();

    if (error) throw new Error(`Failed to create transaction: ${error.message}`);
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
      .select()
      .single();

    if (error) throw new Error(`Failed to update transaction: ${error.message}`);
    return this.mapFromDatabase(data);
  }

  async remove(businessId: string, transactionId: string): Promise<void> {
    const { error } = await this.client
      .from("transactions")
      .delete()
      .eq("business_id", businessId)
      .eq("id", transactionId);

    if (error) throw new Error(`Failed to delete transaction: ${error.message}`);
  }

  // Maps database snake_case row to camelCase domain model
  private mapFromDatabase(row: Record<string, unknown>): FinancialTransaction {
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
  private mapToDatabase(txn: FinancialTransaction): Record<string, unknown> {
    return {
      id: txn.id,
      business_id: txn.businessId,
      direction: txn.direction,
      lifecycle: txn.lifecycle,
      transaction_date: txn.transactionDate,
      accounting_date: txn.accountingDate,
      counterparty_id: txn.counterpartyId,
      counterparty_name_snapshot: txn.counterpartyNameSnapshot,
      source_links: txn.sourceLinks,
      description: txn.description,
      category_code: txn.categoryCode,
      currency: txn.currency,
      exchange_rate_to_myr: txn.exchangeRateToMYR,
      lines: txn.lines,
      totals: txn.totals,
      payment_status: txn.paymentStatus,
      payment_method_code: txn.paymentMethodCode,
      e_invoice_treatment: txn.eInvoiceTreatment,
      confidence_score: txn.confidenceScore,
      confirmation: txn.confirmation,
      void_metadata: txn.voidMetadata,
      created_at: txn.createdAt,
      updated_at: txn.updatedAt,
      created_by: txn.createdBy,
      updated_by: txn.updatedBy,
      version: txn.version,
    };
  }
}
