import type { Transaction } from "@/types";

export const DEMO_WHATSAPP_ORDER_MESSAGE = "Hi Kak Lina, can I order 40 lunch boxes for Friday? Total RM850. I’ll transfer the deposit today.";

export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "txn_001", businessId: "business_demo", createdBy: "demo-lina", type: "income",
    subtotal: 480, tax: 0, total: 480, currency: "MYR", date: "2026-07-14", category: "Sales",
    description: "Morning nasi lemak sales", counterpartyName: "Walk-in customers", paymentMethod: "DuitNow QR",
    sourceType: "manual", status: "confirmed", items: [], createdAt: "2026-07-14T04:45:00.000Z", updatedAt: "2026-07-14T04:45:00.000Z",
  },
  {
    id: "txn_002", businessId: "business_demo", createdBy: "demo-lina", type: "expense",
    subtotal: 86.4, tax: 0, total: 86.4, currency: "MYR", date: "2026-07-13", category: "Inventory",
    description: "Cooking ingredients and packaging", counterpartyName: "Maju Mart", paymentMethod: "Bank Transfer",
    sourceType: "receipt", status: "needs_review", items: [], createdAt: "2026-07-13T10:30:00.000Z", updatedAt: "2026-07-13T10:30:00.000Z",
  },
  {
    id: "txn_003", businessId: "business_demo", createdBy: "demo-lina", type: "income",
    subtotal: 850, tax: 0, total: 850, currency: "MYR", date: "2026-07-12", category: "Catering",
    description: "Catering deposit for 40 guests", counterpartyName: "Suria Events", paymentMethod: "Bank Transfer",
    sourceType: "whatsapp", status: "confirmed", items: [], createdAt: "2026-07-12T06:20:00.000Z", updatedAt: "2026-07-12T06:20:00.000Z",
  },
  {
    id: "txn_004", businessId: "business_demo", createdBy: "demo-lina", type: "expense",
    subtotal: 126.4, tax: 0, total: 126.4, currency: "MYR", date: "2026-07-11", category: "Supplies",
    description: "Weekly grocery purchase", counterpartyName: "Pasar Raya Kita", paymentMethod: "Cash",
    sourceType: "voice", status: "needs_review", items: [], createdAt: "2026-07-11T09:10:00.000Z", updatedAt: "2026-07-11T09:10:00.000Z",
  },
  {
    id: "txn_005", businessId: "business_demo", createdBy: "demo-lina", type: "expense",
    subtotal: 78, tax: 0, total: 78, currency: "MYR", date: "2026-07-10", category: "Utilities",
    description: "Mobile and internet bill", counterpartyName: "CelcomDigi", paymentMethod: "Auto debit",
    sourceType: "csv", status: "confirmed", items: [], createdAt: "2026-07-10T02:05:00.000Z", updatedAt: "2026-07-10T02:05:00.000Z",
  },
  {
    id: "txn_006", businessId: "business_demo", createdBy: "demo-lina", type: "income",
    subtotal: 620, tax: 0, total: 620, currency: "MYR", date: "2026-07-09", category: "Sales",
    description: "Office lunch order", counterpartyName: "Teras Digital", paymentMethod: "Bank Transfer",
    sourceType: "bank_statement", status: "confirmed", items: [], createdAt: "2026-07-09T05:15:00.000Z", updatedAt: "2026-07-09T05:15:00.000Z",
  },
];
