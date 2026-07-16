import { z } from "zod";
import { join } from "node:path";
import {
  commercialDocumentSchema,
  type Business,
  type CommercialDocument,
  type Party,
} from "@/domain";
import {
  MYINVOIS_DEVELOPMENT_REFERENCE_CODES,
  createMyInvoisReferenceCatalog,
  validateMyInvoisReadiness,
  type MyInvoisValidationContext,
  type ReadinessValidationIssue,
} from "@/compliance/myinvois";
import { JsonArrayStore, withLocalStorageLock } from "@/lib/storage/json-store";

/** Canonical document statuses are the draft lifecycle for this specialist. */
export const invoiceReadinessLifecycleSchema = z.enum(["draft", "needs_information", "ready_for_review", "approved", "cancelled"]);
export type InvoiceReadinessLifecycle = z.infer<typeof invoiceReadinessLifecycleSchema>;

export const invoiceReadinessDraftSchema = z.object({
  id: z.string().uuid(),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  sourceTransactionId: z.string().min(1),
  document: commercialDocumentSchema,
  supplier: z.custom<Party>(),
  buyer: z.custom<Party>(),
  business: z.custom<Business>().optional(),
  scenario: z.enum(["b2b_invoice", "b2c_invoice", "consolidated_transaction", "self_billed_invoice", "foreign_buyer", "credit_note", "debit_note", "refund_note"]),
  lifecycle: invoiceReadinessLifecycleSchema,
  approvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InvoiceReadinessDraft = z.infer<typeof invoiceReadinessDraftSchema>;

export type InvoiceReadinessFieldGroup = "buyer" | "seller" | "invoice" | "line_item" | "tax_classification";
export interface InvoiceReadinessFinding extends ReadinessValidationIssue { group: InvoiceReadinessFieldGroup; }
export interface InvoiceReadinessEvaluation {
  ready: boolean;
  missingRequiredFields: InvoiceReadinessFinding[];
  invalidFields: InvoiceReadinessFinding[];
  conditionalFields: InvoiceReadinessFinding[];
  warnings: InvoiceReadinessFinding[];
  sourceEntityReferences: { transactionId: string; documentId: string; buyerId: string; supplierId: string };
  nextClarification: InvoiceReadinessFinding | null;
  readiness: ReturnType<typeof validateMyInvoisReadiness>;
}

export type InvoiceReadinessInput = Omit<InvoiceReadinessDraft, "id" | "telegramUserId" | "telegramChatId" | "lifecycle" | "approvedAt" | "createdAt" | "updatedAt" | "document"> & { document: unknown };

const catalog = createMyInvoisReferenceCatalog(MYINVOIS_DEVELOPMENT_REFERENCE_CODES);

function groupFor(fieldPath: string): InvoiceReadinessFieldGroup {
  if (fieldPath.startsWith("buyer.")) return "buyer";
  if (fieldPath.startsWith("supplier.") || fieldPath.startsWith("business.")) return "seller";
  if (fieldPath.startsWith("document.lines")) return fieldPath.includes("taxTreatment") || fieldPath.includes("classification") ? "tax_classification" : "line_item";
  return "invoice";
}

function isConditional(issue: ReadinessValidationIssue) {
  return issue.ruleId.includes("exchange-rate") || issue.ruleId.includes("adjustment-reference") || issue.ruleId.startsWith("scenario.");
}

/** Uses the project MyInvois rules; this function never maps or submits a provider payload. */
export function evaluateInvoiceReadiness(input: InvoiceReadinessInput): InvoiceReadinessEvaluation {
  // A readiness draft can be incomplete. Retain canonical-schema failures as
  // invalid fields instead of throwing, so the agent can ask for a correction.
  const parsedDocument = commercialDocumentSchema.safeParse(input.document);
  const document = input.document as CommercialDocument;
  const context: MyInvoisValidationContext = {
    document,
    supplier: input.supplier,
    buyer: input.buyer,
    business: input.business,
    scenario: input.scenario,
    referenceData: catalog,
    asOfDate: document.issueDate,
    validatedAt: document.updatedAt,
    documentVersion: "1.1",
  };
  const readiness = validateMyInvoisReadiness(context);
  const schemaFindings: InvoiceReadinessFinding[] = parsedDocument.success ? [] : parsedDocument.error.issues.map((issue) => {
    const fieldPath = issue.path.length ? `document.${issue.path.join(".")}` : "document";
    return { ruleId: "canonical.schema.valid", category: "invoice", severity: "error", fieldPath, message: issue.message, sourceReferenceLabel: "NiagaAI canonical commercial-document schema", group: groupFor(fieldPath) };
  });
  const findings = [...readiness.allIssues.map((issue) => ({ ...issue, group: groupFor(issue.fieldPath) })), ...schemaFindings];
  const errors = findings.filter((issue) => issue.severity === "error");
  const conditionalFields = errors.filter(isConditional);
  const missingRequiredFields = errors.filter((issue) => !isConditional(issue) && /required|present|missing/i.test(issue.message));
  const invalidFields = errors.filter((issue) => !conditionalFields.includes(issue) && !missingRequiredFields.includes(issue));
  const warnings = findings.filter((issue) => issue.severity === "warning");
  return {
    ready: readiness.myInvoisSubmission.ready && schemaFindings.length === 0,
    missingRequiredFields,
    invalidFields,
    conditionalFields,
    warnings,
    sourceEntityReferences: { transactionId: input.sourceTransactionId, documentId: document.id, buyerId: input.buyer.id, supplierId: input.supplier.id },
    nextClarification: [...missingRequiredFields, ...conditionalFields, ...invalidFields][0] ?? null,
    readiness,
  };
}

export interface InvoiceReadinessRepository {
  create(draft: InvoiceReadinessDraft): Promise<InvoiceReadinessDraft>;
  update(draft: InvoiceReadinessDraft): Promise<InvoiceReadinessDraft>;
  findById(id: string): Promise<InvoiceReadinessDraft | null>;
  findBySourceTransaction(sourceTransactionId: string): Promise<InvoiceReadinessDraft | null>;
}

/** Development-only JSON persistence; production wiring must use an owner-scoped server adapter. */
export class LocalInvoiceReadinessRepository implements InvoiceReadinessRepository {
  private readonly store: JsonArrayStore<InvoiceReadinessDraft>;
  constructor(directory: string) { this.store = new JsonArrayStore(join(directory, "invoice-readiness-drafts.json")); }
  async create(draft: InvoiceReadinessDraft) {
    const parsed = invoiceReadinessDraftSchema.parse(draft);
    return withLocalStorageLock(async () => { const values = await this.read(); if (values.some((item) => item.id === parsed.id || item.sourceTransactionId === parsed.sourceTransactionId)) throw new Error("The transaction already has an invoice readiness draft."); values.push(parsed); await this.store.write(values); return parsed; });
  }
  async update(draft: InvoiceReadinessDraft) {
    const parsed = invoiceReadinessDraftSchema.parse(draft);
    return withLocalStorageLock(async () => { const values = await this.read(); const index = values.findIndex((item) => item.id === parsed.id); if (index < 0) throw new Error("Invoice readiness draft no longer exists."); values[index] = parsed; await this.store.write(values); return parsed; });
  }
  async findById(id: string) { return (await this.read()).find((item) => item.id === id) ?? null; }
  async findBySourceTransaction(sourceTransactionId: string) { return (await this.read()).find((item) => item.sourceTransactionId === sourceTransactionId) ?? null; }
  private async read() { return (await this.store.read()).map((value) => invoiceReadinessDraftSchema.parse(value)); }
}

/** Typed application boundary: it only persists a reviewable draft, never submits to MyInvois. */
export class InvoiceReadinessService {
  constructor(private readonly repository: InvoiceReadinessRepository, private readonly now: () => Date = () => new Date()) {}

  async prepare(input: Omit<InvoiceReadinessDraft, "id" | "lifecycle" | "approvedAt" | "createdAt" | "updatedAt">) {
    if (input.document.documentType !== "invoice") return { outcome: "unsupported_transaction_type" as const };
    const existing = await this.repository.findBySourceTransaction(input.sourceTransactionId);
    if (existing) return { outcome: "already_attached" as const, draft: existing, evaluation: evaluateInvoiceReadiness(existing) };
    const timestamp = this.now().toISOString();
    const evaluation = evaluateInvoiceReadiness(input);
    const draft = invoiceReadinessDraftSchema.parse({
      ...input,
      id: crypto.randomUUID(),
      lifecycle: evaluation.ready ? "ready_for_review" : "needs_information",
      approvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return { outcome: "prepared" as const, draft: await this.repository.create(draft), evaluation };
  }

  async correct(id: string, telegramUserId: string, telegramChatId: string, changes: Pick<InvoiceReadinessDraft, "document" | "supplier" | "buyer" | "business" | "scenario">) {
    const draft = await this.repository.findById(id);
    if (!draft || draft.telegramUserId !== telegramUserId || draft.telegramChatId !== telegramChatId) return { outcome: "not_found" as const };
    const evaluation = evaluateInvoiceReadiness({ ...draft, ...changes });
    const updated = await this.repository.update({ ...draft, ...changes, lifecycle: evaluation.ready ? "ready_for_review" : "needs_information", approvedAt: null, updatedAt: this.now().toISOString() });
    return { outcome: "corrected" as const, draft: updated, evaluation };
  }

  async approve(id: string, telegramUserId: string, telegramChatId: string) {
    const draft = await this.repository.findById(id);
    if (!draft || draft.telegramUserId !== telegramUserId || draft.telegramChatId !== telegramChatId) return { outcome: "not_found" as const };
    if (draft.lifecycle === "approved") return { outcome: "already_approved" as const, draft };
    const evaluation = evaluateInvoiceReadiness(draft);
    if (!evaluation.ready) return { outcome: "not_ready" as const, draft, evaluation };
    const approved = await this.repository.update({ ...draft, lifecycle: "approved", approvedAt: this.now().toISOString(), updatedAt: this.now().toISOString() });
    return { outcome: "approved" as const, draft: approved, evaluation };
  }
}

export function resolveInvoicePreparationIntent(text: string, transactionLabels: readonly { id: string; label: string }[]) {
  const normalized = text.toLocaleLowerCase();
  if (!/(invoice|e-invoice|einvoice)/.test(normalized)) return { intent: "none" as const, matches: [] };
  const terms = normalized.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 3 && !["create", "invoice", "e", "for", "the", "this"].includes(term));
  const matches = transactionLabels.filter((item) => {
    const label = item.label.toLocaleLowerCase();
    return normalized.includes(item.id.toLocaleLowerCase()) || terms.some((term) => label.includes(term));
  });
  return { intent: "prepare_invoice" as const, matches };
}
