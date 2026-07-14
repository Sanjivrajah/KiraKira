import type { Business, BusinessMember, Invoice, InvoiceLineItem, InvoiceStatus, Payment, Reminder, Transaction, TransactionLineItem, TransactionSourceType, TransactionStatus, TransactionType } from "@/types";

const LEGACY_BUSINESS_ID = "business_demo";
const LEGACY_USER_ID = "user_demo";
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function transactionLine(value: unknown): TransactionLineItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return isString(item.id) && isString(item.description) && isNumber(item.quantity) && isNumber(item.unitPrice) &&
    isNumber(item.taxRate) && isNumber(item.subtotal) && isNumber(item.tax) && isNumber(item.total)
    ? { id: item.id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate, subtotal: item.subtotal, tax: item.tax, total: item.total }
    : null;
}

export function parseTransaction(value: unknown): Transaction | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const type = String(item.type) as TransactionType;
  const sourceType = String(item.sourceType ?? item.source) as TransactionSourceType;
  const legacyStatus = String(item.status);
  const status = (legacyStatus === "reviewed" ? "confirmed" : legacyStatus === "processing" ? "draft" : legacyStatus) as TransactionStatus;
  const total = item.total ?? item.amount;
  const items = Array.isArray(item.items) ? item.items.map(transactionLine) : [];
  if (!isString(item.id) || !(["income", "expense"] as string[]).includes(type) || !isNumber(total) || !isString(item.date) ||
    !isString(item.category) || !isString(item.description) || !(["receipt", "voice", "manual", "csv", "bank_statement", "whatsapp"] as string[]).includes(sourceType) ||
    !(["draft", "needs_review", "confirmed", "failed"] as string[]).includes(status) || !isString(item.createdAt) || items.some((line) => line === null)) return null;
  return {
    id: item.id, businessId: isString(item.businessId) ? item.businessId : LEGACY_BUSINESS_ID,
    createdBy: isString(item.createdBy) ? item.createdBy : LEGACY_USER_ID, type, status, sourceType,
    sourceDocumentId: isString(item.sourceDocumentId) ? item.sourceDocumentId : null, date: item.date,
    counterpartyId: isString(item.counterpartyId) ? item.counterpartyId : null,
    counterpartyName: isString(item.counterpartyName) ? item.counterpartyName : isString(item.customerName) ? item.customerName : isString(item.merchantName) ? item.merchantName : "",
    description: item.description, category: item.category, currency: "MYR", subtotal: isNumber(item.subtotal) ? item.subtotal : total,
    tax: isNumber(item.tax) ? item.tax : 0, total, paymentMethod: isString(item.paymentMethod) ? item.paymentMethod : null,
    confidenceScore: isNumber(item.confidenceScore) ? item.confidenceScore : null, notes: isString(item.notes) ? item.notes : null,
    items: items.filter((line): line is TransactionLineItem => line !== null), createdAt: item.createdAt,
    updatedAt: isString(item.updatedAt) ? item.updatedAt : item.createdAt,
  };
}

function invoiceLine(value: unknown): InvoiceLineItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return isString(item.id) && isString(item.description) && isNumber(item.quantity) && isNumber(item.unitPrice) && isNumber(item.taxRate)
    ? { id: item.id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate } : null;
}

export function parseInvoice(value: unknown): Invoice | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const rawStatus = String(item.status);
  const status = (rawStatus === "overdue" ? "sent" : rawStatus) as InvoiceStatus;
  const items = Array.isArray(item.items) ? item.items.map(invoiceLine) : [];
  if (!isString(item.id) || !isString(item.invoiceNumber) || !isString(item.customerName) || !isString(item.issueDate) || !isString(item.dueDate) ||
    !(["draft", "sent", "partially_paid", "paid", "void"] as string[]).includes(status) || !items.length || items.some((line) => line === null) ||
    !isNumber(item.subtotal) || !isNumber(item.tax) || !isNumber(item.total) || !isString(item.createdAt)) return null;
  return {
    id: item.id, businessId: isString(item.businessId) ? item.businessId : LEGACY_BUSINESS_ID,
    customerId: isString(item.customerId) ? item.customerId : null, invoiceNumber: item.invoiceNumber, customerName: item.customerName,
    customerEmail: isString(item.customerEmail) ? item.customerEmail : null, buyerTin: isString(item.buyerTin) ? item.buyerTin : null,
    issueDate: item.issueDate, dueDate: item.dueDate, status, currency: "MYR",
    items: items.filter((line): line is InvoiceLineItem => line !== null), subtotal: item.subtotal, tax: item.tax, total: item.total,
    amountPaid: isNumber(item.amountPaid) ? item.amountPaid : status === "paid" ? item.total : 0,
    notes: isString(item.notes) ? item.notes : null, paymentTerms: isString(item.paymentTerms) ? item.paymentTerms : null,
    createdAt: item.createdAt, updatedAt: isString(item.updatedAt) ? item.updatedAt : item.createdAt,
  };
}

export function parseReminder(value: unknown): Reminder | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const sentAt = isString(item.sentAt) ? item.sentAt : isString(item.remindedAt) ? item.remindedAt : null;
  if (!isString(item.invoiceId) || !sentAt) return null;
  return {
    id: isString(item.id) ? item.id : `reminder_${item.invoiceId}`, businessId: isString(item.businessId) ? item.businessId : LEGACY_BUSINESS_ID,
    invoiceId: item.invoiceId, recipient: isString(item.recipient) ? item.recipient : "", messagePreview: isString(item.messagePreview) ? item.messagePreview : null,
    templateKey: isString(item.templateKey) ? item.templateKey : null,
    channel: item.channel === "email" || item.channel === "sms" || item.channel === "whatsapp" ? item.channel : "manual",
    status: item.status === "scheduled" || item.status === "failed" || item.status === "cancelled" ? item.status : "sent",
    scheduledAt: isString(item.scheduledAt) ? item.scheduledAt : null, sentAt,
    createdAt: isString(item.createdAt) ? item.createdAt : sentAt, updatedAt: isString(item.updatedAt) ? item.updatedAt : sentAt,
  };
}

export function parsePayment(value: unknown): Payment | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!isString(item.id) || !isString(item.businessId) || !isString(item.invoiceId) || !isNumber(item.amount) || !isString(item.paidAt) ||
    !(["pending", "completed", "failed", "refunded"] as unknown[]).includes(item.status) || !isString(item.createdAt) || !isString(item.updatedAt)) return null;
  return { id: item.id, businessId: item.businessId, invoiceId: item.invoiceId, amount: item.amount, currency: "MYR", paidAt: item.paidAt,
    method: isString(item.method) ? item.method : null, reference: isString(item.reference) ? item.reference : null,
    status: item.status as Payment["status"], createdAt: item.createdAt, updatedAt: item.updatedAt };
}

export function parseBusiness(value: unknown): Business | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!isString(item.id) || !isString(item.name) || !(["food_beverage", "retail", "services", "online_seller", "other"] as unknown[]).includes(item.type) ||
    !(["en", "ms"] as unknown[]).includes(item.preferredLanguage) || !isString(item.createdAt) || !isString(item.updatedAt)) return null;
  return { id: item.id, name: item.name, type: item.type as Business["type"], registrationNumber: isString(item.registrationNumber) ? item.registrationNumber : null,
    tin: isString(item.tin) ? item.tin : null, currency: "MYR", preferredLanguage: item.preferredLanguage as Business["preferredLanguage"],
    createdAt: item.createdAt, updatedAt: item.updatedAt };
}

export function parseBusinessMember(value: unknown): BusinessMember | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!isString(item.id) || !isString(item.businessId) || !isString(item.userId) ||
    !(["owner", "admin", "member"] as unknown[]).includes(item.role) || !isString(item.createdAt) || !isString(item.updatedAt)) return null;
  return { id: item.id, businessId: item.businessId, userId: item.userId, role: item.role as BusinessMember["role"], createdAt: item.createdAt, updatedAt: item.updatedAt };
}
