import type { Invoice, InvoiceItem, InvoiceStatus } from "@/types/finance";
import type { BusinessProfile } from "@/types/business";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateInvoiceTotals(items: Pick<InvoiceItem, "quantity" | "unitPrice" | "taxRate">[]) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const tax = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100), 0));
  return { subtotal, tax, total: roundMoney(subtotal + tax) };
}

export function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function startOfLocalDay(value = new Date()): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function daysFromDueDate(dueDate: string, today = new Date()): number {
  const millisecondsPerDay = 86_400_000;
  return Math.round((startOfLocalDay(today).getTime() - parseLocalDate(dueDate).getTime()) / millisecondsPerDay);
}

export function getEffectiveInvoiceStatus(invoice: Pick<Invoice, "status" | "dueDate">, today = new Date()): InvoiceStatus {
  if (invoice.status === "paid" || invoice.status === "draft") return invoice.status;
  return daysFromDueDate(invoice.dueDate, today) > 0 ? "overdue" : invoice.status === "overdue" ? "sent" : invoice.status;
}

export interface ReadinessCheck {
  label: string;
  ready: boolean;
}

export function getInvoiceReadinessChecks({
  business,
  customerName,
  buyerTin,
  issueDate,
  items,
}: {
  business: BusinessProfile | null;
  customerName: string;
  buyerTin: string;
  issueDate: string;
  items: Pick<InvoiceItem, "description" | "quantity" | "unitPrice" | "taxRate">[];
}): ReadinessCheck[] {
  return [
    { label: "Seller business name", ready: Boolean(business?.name.trim()) },
    { label: "Seller registration number", ready: Boolean(business?.registrationNumber.trim()) },
    { label: "Buyer name", ready: Boolean(customerName.trim()) },
    { label: "Buyer TIN placeholder", ready: Boolean(buyerTin.trim()) },
    { label: "Invoice date", ready: Boolean(issueDate) },
    { label: "Item descriptions", ready: items.length > 0 && items.every((item) => Boolean(item.description.trim())) },
    { label: "Quantities and unit prices", ready: items.length > 0 && items.every((item) => item.quantity > 0 && item.unitPrice >= 0) },
    { label: "Tax information", ready: items.length > 0 && items.every((item) => Number.isFinite(item.taxRate) && item.taxRate >= 0) },
  ];
}
