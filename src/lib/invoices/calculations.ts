import type { Business, BusinessInput, EffectiveInvoiceStatus, Invoice, InvoiceLineItem } from "@/types";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateInvoiceTotals(items: Pick<InvoiceLineItem, "quantity" | "unitPrice" | "taxRate" | "discountAmount" | "chargeAmount">[]) {
  const lineNet = (item: typeof items[number]) => item.quantity * item.unitPrice - (item.discountAmount ?? 0) + (item.chargeAmount ?? 0);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + lineNet(item), 0));
  const tax = roundMoney(items.reduce((sum, item) => sum + lineNet(item) * (item.taxRate / 100), 0));
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

export function getEffectiveInvoiceStatus(invoice: Pick<Invoice, "status" | "dueDate">, today = new Date()): EffectiveInvoiceStatus {
  if (invoice.status !== "sent") return invoice.status;
  return daysFromDueDate(invoice.dueDate, today) > 0 ? "overdue" : "sent";
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
  business: Business | BusinessInput | null;
  customerName: string;
  buyerTin: string;
  issueDate: string;
  items: Pick<InvoiceLineItem, "description" | "quantity" | "unitPrice" | "taxRate">[];
}): ReadinessCheck[] {
  return [
    { label: "Seller business name", ready: Boolean(business?.name.trim()) },
    { label: "Seller registration number", ready: Boolean(business?.registrationNumber?.trim()) },
    { label: "Buyer name", ready: Boolean(customerName.trim()) },
    { label: "Buyer TIN placeholder", ready: Boolean(buyerTin.trim()) },
    { label: "Invoice date", ready: Boolean(issueDate) },
    { label: "Item descriptions", ready: items.length > 0 && items.every((item) => Boolean(item.description.trim())) },
    { label: "Quantities and unit prices", ready: items.length > 0 && items.every((item) => item.quantity > 0 && item.unitPrice >= 0) },
    { label: "Tax information", ready: items.length > 0 && items.every((item) => Number.isFinite(item.taxRate) && item.taxRate >= 0) },
  ];
}
