"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, ChevronRight, Circle, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { CommercialDocument, Party } from "@/domain";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { DEMO_BUSINESS, DEMO_CUSTOMERS } from "@/data/demo";
import { FRONTEND_STORAGE_KEYS } from "@/frontend/storage";
import {
  GENERAL_PUBLIC_PARTY_VIEW_MODEL,
  invoiceBuilderToDomain,
  partyEditorToDomain,
  readinessGroupReady,
  type FrontendReadinessViewModel,
  type PartyEditorViewModel,
} from "@/frontend/view-models";
import { useBusiness } from "@/hooks/use-business";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { browserStorage } from "@/lib/storage/browser-storage";
import { invoiceFormSchema, type InvoiceFormValues, type ValidInvoiceFormValues } from "@/lib/validation/invoice";

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const makeItemId = () => `item_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
const documentTypes = [
  ["invoice", "Invoice"], ["credit_note", "Credit note"], ["debit_note", "Debit note"], ["refund_note", "Refund note"],
  ["self_billed_invoice", "Self-billed invoice"], ["self_billed_credit_note", "Self-billed credit note"],
  ["self_billed_debit_note", "Self-billed debit note"], ["self_billed_refund_note", "Self-billed refund note"],
].map(([value, label]) => ({ value, label }));

function initialParties(): Party[] {
  const stored = browserStorage.get<Party[]>(FRONTEND_STORAGE_KEYS.parties, []);
  if (stored.length) return stored;
  const now = "2026-07-15T00:00:00.000Z";
  return [
    ...DEMO_CUSTOMERS.map((customer) => partyEditorToDomain({
      id: customer.id,
      kind: "business",
      legalName: customer.name,
      tin: customer.tin || "EI00000000010",
      registrationScheme: "brn",
      registrationValue: "NA",
      email: customer.email || "",
      phone: "",
      addressLine1: "Address pending review",
      addressLine2: "",
      city: "City pending review",
      postcode: "",
      stateCode: "17",
      countryCode: "MY",
    }, { id: customer.id, now })),
    partyEditorToDomain(GENERAL_PUBLIC_PARTY_VIEW_MODEL, { now }),
  ];
}

const emptyBuyer: PartyEditorViewModel = {
  id: "", kind: "business", legalName: "", tin: "", registrationScheme: "brn", registrationValue: "",
  email: "", phone: "", addressLine1: "", addressLine2: "", city: "", postcode: "", stateCode: "17", countryCode: "MY",
};

export function InvoiceBuilder({ now }: { now: string }) {
  const router = useRouter();
  const createInvoice = useCreateInvoice();
  const business = useBusiness().data ?? null;
  const today = useMemo(() => new Date(now), [now]);
  const due = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14), [today]);
  const [parties, setParties] = useState(initialParties);
  const [showBuyerEditor, setShowBuyerEditor] = useState(false);
  const [buyerDraft, setBuyerDraft] = useState(emptyBuyer);
  const [buyerError, setBuyerError] = useState("");
  const { control, register, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<InvoiceFormValues, unknown, ValidInvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      documentType: "invoice",
      invoiceNumber: `INV-${isoDate(today).replaceAll("-", "")}`,
      buyerId: parties[0]?.id ?? "",
      issueDate: isoDate(today),
      issueTime: "09:00",
      dueDate: isoDate(due),
      status: "draft",
      originalDocumentReference: "",
      paymentModeCode: "03",
      bankAccountIdentifier: "",
      items: [{
        id: "item_initial", description: "", quantity: 1, unitPrice: 0, classificationCode: "022", unitCode: "C62",
        taxTypeCode: "06", taxRate: 0, exemptionReason: "", discountAmount: 0, chargeAmount: 0,
      }],
      notes: "",
      paymentTerms: "Payment due within 14 days.",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });
  const selectedBuyer = parties.find((party) => party.id === watched.buyerId);
  const items = (watched.items ?? []).map((item) => ({
    description: item?.description || "",
    quantity: Number(item?.quantity) || 0,
    unitPrice: Number(item?.unitPrice) || 0,
    taxRate: Number(item?.taxRate) || 0,
    discountAmount: Number(item?.discountAmount) || 0,
    chargeAmount: Number(item?.chargeAmount) || 0,
  }));
  const totals = calculateInvoiceTotals(items);
  const adjustmentDocument = Boolean(watched.documentType && !["invoice", "self_billed_invoice"].includes(watched.documentType));
  const readiness: FrontendReadinessViewModel = {
    bookkeeping: [
      { id: "seller-name", label: "Seller legal name", ready: Boolean(business?.legalName || business?.name), severity: "error", fieldPath: "business.legalName", message: "Complete the business legal name in onboarding." },
      { id: "seller-registration", label: "Seller registration", ready: Boolean(business?.registrationNumber), severity: "warning", fieldPath: "business.registrationNumber", message: "Add the seller registration number before submission." },
    ],
    invoice: [
      { id: "buyer", label: "Customer details", ready: Boolean(selectedBuyer), severity: "error", fieldPath: "buyerId", message: "Choose or create a customer." },
      { id: "line-description", label: "Item descriptions", ready: items.length > 0 && items.every((item) => item.description.trim().length >= 2), severity: "error", fieldPath: "items.0.description", message: "Describe every invoice item." },
      { id: "original-reference", label: "Original document reference", ready: !adjustmentDocument || Boolean(watched.originalDocumentReference?.trim()), severity: "error", fieldPath: "originalDocumentReference", message: "Adjustment documents require an original reference." },
    ],
    myInvoisSubmission: [
      { id: "buyer-tin", label: "Buyer TIN", ready: Boolean(selectedBuyer?.taxIdentifiers.some((identifier) => identifier.scheme === "tin")), severity: "error", fieldPath: "buyerId", message: "Choose a buyer with a TIN." },
      { id: "buyer-address", label: "Customer address", ready: Boolean(selectedBuyer?.billingAddress), severity: "error", fieldPath: "buyerId", message: "Add the customer’s billing address." },
      { id: "classification", label: "Classification codes", ready: Boolean(watched.items?.every((item) => item?.classificationCode)), severity: "error", fieldPath: "items.0.classificationCode", message: "Choose a classification for every item." },
      { id: "tax-type", label: "Tax type codes", ready: Boolean(watched.items?.every((item) => item?.taxTypeCode)), severity: "error", fieldPath: "items.0.taxTypeCode", message: "Choose a tax type for every item." },
    ],
  };

  const focusField = (fieldPath: string) => {
    const input = document.querySelector<HTMLElement>(`[name="${fieldPath}"]`);
    input?.focus();
    input?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  const createBuyer = () => {
    setBuyerError("");
    try {
      const party = partyEditorToDomain(buyerDraft, { id: `party_${Date.now()}`, now: new Date().toISOString() });
      const next = [...parties.filter((existing) => existing.id !== party.id), party];
      setParties(next);
      browserStorage.set(FRONTEND_STORAGE_KEYS.parties, next);
      setValue("buyerId", party.id, { shouldValidate: true });
      setShowBuyerEditor(false);
      setBuyerDraft(emptyBuyer);
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : "Buyer could not be created.");
    }
  };

  const submit = async (values: ValidInvoiceFormValues) => {
    const buyer = parties.find((party) => party.id === values.buyerId);
    if (!buyer) return setError("buyerId", { message: "Choose or create a buyer." });
    try {
      const domainInput = {
        documentType: values.documentType,
        invoiceNumber: values.invoiceNumber,
        issueDate: values.issueDate,
        issueTime: values.issueTime,
        dueDate: values.dueDate,
        buyerId: values.buyerId,
        originalDocumentReference: values.originalDocumentReference,
        paymentModeCode: values.paymentModeCode,
        bankAccountIdentifier: values.bankAccountIdentifier,
        paymentTerms: values.paymentTerms,
        notes: values.notes,
        lines: values.items.map((item) => ({
          ...item,
          quantity: String(item.quantity), unitPrice: String(item.unitPrice), taxRate: String(item.taxRate),
          discountAmount: String(item.discountAmount), chargeAmount: String(item.chargeAmount),
        })),
      };
      invoiceBuilderToDomain(domainInput, {
        id: `document_pending_${now.replace(/\W/g, "")}`,
        businessId: business?.id || DEMO_BUSINESS.id,
        supplierPartyId: `party_${business?.id || DEMO_BUSINESS.id}`,
        now: new Date().toISOString(),
      });
      const saved = await createInvoice.mutateAsync({
        businessId: business?.id || DEMO_BUSINESS.id,
        customerId: buyer.id,
        invoiceNumber: values.invoiceNumber,
        customerName: buyer.legalName,
        customerEmail: buyer.email ?? null,
        buyerTin: buyer.taxIdentifiers.find((identifier) => identifier.scheme === "tin")?.value ?? null,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        status: values.status,
        currency: "MYR",
        amountPaid: 0,
        items: values.items.map((item) => ({ ...item, id: item.id || makeItemId() })),
        notes: values.notes,
        paymentTerms: values.paymentTerms,
      });
      const domain = invoiceBuilderToDomain(domainInput, {
        id: saved.id,
        businessId: saved.businessId,
        supplierPartyId: `party_${saved.businessId}`,
        now: saved.createdAt,
      });
      const existing = browserStorage.get<CommercialDocument[]>(FRONTEND_STORAGE_KEYS.documents, []);
      browserStorage.set(FRONTEND_STORAGE_KEYS.parties, parties);
      browserStorage.set(FRONTEND_STORAGE_KEYS.documents, [domain, ...existing.filter((document) => document.id !== domain.id)]);
      router.push("/invoices?created=1");
    } catch (error) {
      setError("root", { message: error instanceof Error ? error.message : "Invoice could not be saved." });
    }
  };

  return <>
    <PageHeader eyebrow="Sales documents" title="Create an invoice or note" description="Add the customer and items. We’ll show what still needs attention before you save." />
    <form className="invoice-builder-grid" noValidate onSubmit={handleSubmit(submit)}>
      <div className="invoice-form-column">
        <section className="panel invoice-form-section" aria-labelledby="basic-details-heading">
          <p className="section-kicker">1 · Basic details</p><h2 id="basic-details-heading">Document details</h2>
          <div className="review-form-grid">
            <SelectField error={errors.documentType?.message} label="Document type" options={documentTypes} {...register("documentType")} />
            <SelectField error={errors.status?.message} label="Starting status" options={[{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }]} {...register("status")} />
            <FormField error={errors.invoiceNumber?.message} label="Document number" {...register("invoiceNumber")} />
            <FormField error={errors.issueDate?.message} label="Issue date" type="date" {...register("issueDate")} />
            <FormField error={errors.issueTime?.message} label="Issue time" type="time" {...register("issueTime")} />
            <FormField error={errors.dueDate?.message} label="Due date" type="date" {...register("dueDate")} />
            {adjustmentDocument ? <FormField className="review-wide" error={errors.originalDocumentReference?.message} label="Original document reference" {...register("originalDocumentReference")} /> : null}
          </div>
        </section>

        <section className="panel invoice-form-section" aria-labelledby="buyer-heading">
          <p className="section-kicker">2 · Customer</p><h2 id="buyer-heading">Customer details</h2>
          <div className="buyer-toolbar">
            <SelectField error={errors.buyerId?.message} label="Customer" options={parties.map((party) => ({ value: party.id, label: party.legalName }))} value={watched.buyerId || ""} {...register("buyerId")} />
            <button className="button button-secondary" onClick={() => setShowBuyerEditor((open) => !open)} type="button"><UserPlus aria-hidden="true" size={17} />Create customer</button>
            <button className="button button-secondary" onClick={() => setValue("buyerId", "party_general_public", { shouldValidate: true })} type="button">Use General Public</button>
          </div>
          {selectedBuyer ? <p className="structured-party-summary"><strong>{selectedBuyer.legalName}</strong><span>{selectedBuyer.taxIdentifiers.find((identifier) => identifier.scheme === "tin")?.value || "TIN incomplete"} · {selectedBuyer.billingAddress?.city || "Address incomplete"}</span></p> : null}
          {showBuyerEditor ? <fieldset className="customer-editor"><legend>New customer</legend><div className="review-form-grid">
            <SelectField id="buyer-kind" label="Party type" options={[{ value: "business", label: "Business" }, { value: "individual", label: "Individual" }, { value: "government_entity", label: "Government entity" }, { value: "foreign_entity", label: "Foreign entity" }]} value={buyerDraft.kind} onChange={(event) => setBuyerDraft({ ...buyerDraft, kind: event.target.value as PartyEditorViewModel["kind"] })} />
            <FormField id="buyer-legal-name" label="Legal name" value={buyerDraft.legalName} onChange={(event) => setBuyerDraft({ ...buyerDraft, legalName: event.target.value })} />
            <FormField id="buyer-tin" label="TIN" value={buyerDraft.tin} onChange={(event) => setBuyerDraft({ ...buyerDraft, tin: event.target.value })} />
            <SelectField id="buyer-registration-type" label="Registration type" options={[{ value: "brn", label: "BRN" }, { value: "nric", label: "NRIC" }, { value: "passport", label: "Passport" }, { value: "army_number", label: "Army number" }]} value={buyerDraft.registrationScheme} onChange={(event) => setBuyerDraft({ ...buyerDraft, registrationScheme: event.target.value as PartyEditorViewModel["registrationScheme"] })} />
            <FormField id="buyer-registration-value" label="Registration value" value={buyerDraft.registrationValue} onChange={(event) => setBuyerDraft({ ...buyerDraft, registrationValue: event.target.value })} />
            <FormField id="buyer-email" label="Email" type="email" value={buyerDraft.email} onChange={(event) => setBuyerDraft({ ...buyerDraft, email: event.target.value })} />
            <FormField id="buyer-phone" label="Phone" value={buyerDraft.phone} onChange={(event) => setBuyerDraft({ ...buyerDraft, phone: event.target.value })} />
            <FormField id="buyer-address-line-1" label="Address line 1" value={buyerDraft.addressLine1} onChange={(event) => setBuyerDraft({ ...buyerDraft, addressLine1: event.target.value })} />
            <FormField id="buyer-city" label="City" value={buyerDraft.city} onChange={(event) => setBuyerDraft({ ...buyerDraft, city: event.target.value })} />
            <FormField id="buyer-postcode" label="Postcode" value={buyerDraft.postcode} onChange={(event) => setBuyerDraft({ ...buyerDraft, postcode: event.target.value })} />
            <FormField id="buyer-state-code" label="State code" value={buyerDraft.stateCode} onChange={(event) => setBuyerDraft({ ...buyerDraft, stateCode: event.target.value })} />
            <FormField id="buyer-country-code" label="Country code" value={buyerDraft.countryCode} onChange={(event) => setBuyerDraft({ ...buyerDraft, countryCode: event.target.value.toUpperCase() })} />
          </div>{buyerError ? <p className="field-error" role="alert">{buyerError}</p> : null}<button className="button button-primary" onClick={createBuyer} type="button">Save customer</button></fieldset> : null}
        </section>

        <section className="panel invoice-form-section" aria-labelledby="items-heading">
          <div className="invoice-section-heading"><div><p className="section-kicker">3 and 4 · Items, tax and classification</p><h2 id="items-heading">Line items</h2></div><button className="button button-secondary compact-button" onClick={() => append({ id: makeItemId(), description: "", quantity: 1, unitPrice: 0, classificationCode: "022", unitCode: "C62", taxTypeCode: "06", taxRate: 0, exemptionReason: "", discountAmount: 0, chargeAmount: 0 })} type="button"><Plus aria-hidden="true" size={16} />Add item</button></div>
          <datalist id="classification-codes"><option value="022">Others</option><option value="004">Consolidated e-Invoice</option><option value="036">Self-billed others</option></datalist>
          <datalist id="unit-codes"><option value="C62">One</option><option value="KGM">Kilogram</option></datalist>
          <datalist id="tax-type-codes"><option value="06">Not applicable</option><option value="02">Service tax</option><option value="01">Sales tax</option><option value="E">Tax exemption</option></datalist>
          <div className="line-items">{fields.map((field, index) => <fieldset className="line-item migrated-line-item" key={field.id}><legend>Item {index + 1}</legend>
            <FormField className="line-description" error={errors.items?.[index]?.description?.message} label="Description" {...register(`items.${index}.description`)} />
            <FormField error={errors.items?.[index]?.quantity?.message} label="Quantity" min="0.01" step="0.01" type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
            <FormField error={errors.items?.[index]?.unitPrice?.message} label="Unit price (RM)" min="0" step="0.01" type="number" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
            <input type="hidden" {...register(`items.${index}.id`)} />
            <button aria-label={`Remove item ${index + 1}`} className="remove-line-item" disabled={fields.length === 1} onClick={() => remove(index)} type="button"><Trash2 aria-hidden="true" size={17} />Remove</button>
            <details className="advanced-fields"><summary>Tax, classification and adjustments <ChevronRight aria-hidden="true" size={16} /></summary><div className="review-form-grid">
              <FormField error={errors.items?.[index]?.classificationCode?.message} hint="Type to search the supported demo codes." label="Classification code" list="classification-codes" {...register(`items.${index}.classificationCode`)} />
              <FormField error={errors.items?.[index]?.unitCode?.message} hint="Type to search the supported demo codes." label="Unit code" list="unit-codes" {...register(`items.${index}.unitCode`)} />
              <FormField error={errors.items?.[index]?.taxTypeCode?.message} hint="Type to search the supported demo codes." label="Tax type code" list="tax-type-codes" {...register(`items.${index}.taxTypeCode`)} />
              <FormField error={errors.items?.[index]?.taxRate?.message} label="Tax rate (%)" min="0" max="100" step="0.01" type="number" {...register(`items.${index}.taxRate`, { valueAsNumber: true })} />
              <FormField error={errors.items?.[index]?.exemptionReason?.message} label="Exemption reason" {...register(`items.${index}.exemptionReason`)} />
              <FormField error={errors.items?.[index]?.discountAmount?.message} label="Discount (RM)" min="0" step="0.01" type="number" {...register(`items.${index}.discountAmount`, { valueAsNumber: true })} />
              <FormField error={errors.items?.[index]?.chargeAmount?.message} label="Charges (RM)" min="0" step="0.01" type="number" {...register(`items.${index}.chargeAmount`, { valueAsNumber: true })} />
            </div></details>
          </fieldset>)}</div>
        </section>

        <details className="panel invoice-form-section progressive-section"><summary>5 · Payment</summary><div className="review-form-grid">
          <SelectField error={errors.paymentModeCode?.message} label="Payment mode" options={[{ value: "03", label: "Bank transfer" }, { value: "01", label: "Cash" }]} {...register("paymentModeCode")} />
          <FormField error={errors.bankAccountIdentifier?.message} label="Bank account" {...register("bankAccountIdentifier")} />
          <TextareaField className="review-wide" error={errors.paymentTerms?.message} label="Payment terms" rows={3} {...register("paymentTerms")} />
        </div></details>
        <details className="panel invoice-form-section progressive-section"><summary>6 · Additional details</summary><TextareaField error={errors.notes?.message} label="Notes" rows={4} {...register("notes")} /></details>
        {errors.root?.message ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} />{errors.root.message}</div> : null}
        <div className="invoice-save-actions"><button className="button button-secondary" onClick={() => router.push("/invoices")} type="button">Cancel</button><button className="button button-primary" disabled={isSubmitting || createInvoice.isPending} type="submit"><Save aria-hidden="true" size={18} />Save document</button></div>
      </div>

      <aside className="invoice-preview-column">
        <section className="invoice-preview panel" aria-label="Invoice preview"><p className="section-kicker">Live preview</p><h2>{watched.invoiceNumber || "New document"}</h2><p><strong>Buyer:</strong> {selectedBuyer?.legalName || "Choose a buyer"}</p><div className="preview-items">{items.map((item, index) => <div className="preview-item-row" key={fields[index]?.id}><span>{item.description || `Item ${index + 1}`}</span><MoneyDisplay amount={item.quantity * item.unitPrice - item.discountAmount + item.chargeAmount} /></div>)}</div><dl className="invoice-totals"><div><dt>Subtotal</dt><dd><MoneyDisplay amount={totals.subtotal} /></dd></div><div><dt>Tax</dt><dd><MoneyDisplay amount={totals.tax} /></dd></div><div className="invoice-total"><dt>Total</dt><dd><MoneyDisplay amount={totals.total} /></dd></div></dl></section>
        <section className="readiness-card panel" aria-labelledby="readiness-heading"><p className="section-kicker">7 · Final check</p><h2 id="readiness-heading">Before you save</h2>
          {(Object.entries(readiness) as Array<[keyof FrontendReadinessViewModel, FrontendReadinessViewModel[keyof FrontendReadinessViewModel]]>).map(([key, actions]) => {
            const prerequisites = key === "myInvoisSubmission"
              ? [...readiness.bookkeeping, ...readiness.invoice]
              : [];
            const groupReady = readinessGroupReady(actions, prerequisites);
            const groupLabel = key === "bookkeeping" ? "Business details" : key === "invoice" ? "Document details" : "MyInvois details";
            return <div className="readiness-group" key={key}><h3>{groupLabel} <span>{groupReady ? "Ready" : "Needs action"}</span></h3>{key === "myInvoisSubmission" && !readinessGroupReady(prerequisites) ? <p className="readiness-prerequisite">Complete the business and document details above first.</p> : null}<ul>{actions.map((action) => <li key={action.id}>{action.ready ? <Check aria-hidden="true" size={15} /> : <Circle aria-hidden="true" size={14} />}<button disabled={action.ready || action.fieldPath.startsWith("business.")} onClick={() => focusField(action.fieldPath)} type="button"><strong>{action.label}</strong>{!action.ready ? <small>{action.message}</small> : null}</button></li>)}</ul></div>;
          })}
          <p className="readiness-disclosure">This check is only a guide. Nothing has been sent to MyInvois.</p>
        </section>
      </aside>
    </form>
  </>;
}
