import type { Invoice } from "@/types";

export const DEMO_INVOICES: Invoice[] = [
  {
    id: "inv_1024", businessId: "business_demo", customerId: "customer_kedai_murni", invoiceNumber: "INV-1024", customerName: "Kedai Murni", customerEmail: "accounts@kedaimurni.demo",
    buyerTin: "EI00000000010", issueDate: "2026-06-26", dueDate: "2026-07-10", status: "sent",
    items: [{ id: "item_1024_1", description: "Corporate lunch catering", quantity: 1, unitPrice: 850, taxRate: 0 }],
    subtotal: 850, tax: 0, total: 850, amountPaid: 0, currency: "MYR", paymentTerms: "Payment due within 14 days.", notes: "Thank you for your business.",
    createdAt: "2026-06-26T03:00:00.000Z", updatedAt: "2026-06-26T03:00:00.000Z",
  },
  {
    id: "inv_1023", businessId: "business_demo", customerId: "customer_teras_digital", invoiceNumber: "INV-1023", customerName: "Teras Digital", customerEmail: "finance@terasdigital.demo",
    buyerTin: "EI00000000020", issueDate: "2026-07-06", dueDate: "2026-07-20", status: "sent",
    items: [{ id: "item_1023_1", description: "Office lunch order", quantity: 4, unitPrice: 155, taxRate: 0 }],
    subtotal: 620, tax: 0, total: 620, amountPaid: 0, currency: "MYR", paymentTerms: "Payment due within 14 days.",
    createdAt: "2026-07-06T02:00:00.000Z", updatedAt: "2026-07-06T02:00:00.000Z",
  },
  {
    id: "inv_1022", businessId: "business_demo", customerId: "customer_suria_events", invoiceNumber: "INV-1022", customerName: "Suria Events",
    issueDate: "2026-06-18", dueDate: "2026-07-02", status: "paid",
    items: [{ id: "item_1022_1", description: "Event catering deposit", quantity: 1, unitPrice: 1200, taxRate: 0 }],
    subtotal: 1200, tax: 0, total: 1200, amountPaid: 1200, currency: "MYR", paymentTerms: "Payment due within 14 days.",
    createdAt: "2026-06-18T05:30:00.000Z", updatedAt: "2026-07-01T07:00:00.000Z",
  },
];
