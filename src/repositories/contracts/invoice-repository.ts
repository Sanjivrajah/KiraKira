import type { Invoice } from "@/types";

export interface InvoiceRepository {
  list(input: { businessId: string }): Promise<Invoice[]>;
  getById(input: { businessId: string; invoiceId: string }): Promise<Invoice | null>;
  create(input: { invoice: Invoice }): Promise<Invoice>;
  update(input: { businessId: string; invoiceId: string; changes: Partial<Invoice> }): Promise<Invoice>;
  remove(input: { businessId: string; invoiceId: string }): Promise<void>;
  initializeDemo(input: { businessId: string; fixtures: Invoice[] }): Promise<Invoice[]>;
  clearForBusiness(input: { businessId: string }): Promise<void>;
  clear(): Promise<void>;
}
