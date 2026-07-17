"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ChevronRight, Circle, Plus, Save, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { partySchema, type CommercialDocument, type Party } from "@/domain";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { DEMO_BUSINESS, DEMO_CUSTOMERS } from "@/data/demo";
import { FRONTEND_STORAGE_KEYS } from "@/frontend/storage";
import {
  GENERAL_PUBLIC_PARTY_VIEW_MODEL,
  businessOnboardingToDomain,
  businessOnboardingViewModelSchema,
  createInvoicePreparationResult,
  invoiceBuilderToDomain,
  invoicePreparationFieldTarget,
  invoicePreparationFixLabel,
  partyEditorToDomain,
  type PartyEditorViewModel,
} from "@/frontend/view-models";
import { useBusiness } from "@/hooks/use-business";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { browserStorage } from "@/lib/storage/browser-storage";
import { invoiceFormSchema, type InvoiceFormValues, type ValidInvoiceFormValues } from "@/lib/validation/invoice";
import { createSupabaseParty, listSupabaseParties } from "@/services/party-service";

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
    ...DEMO_CUSTOMERS.map((customer) => partySchema.parse({
      id: customer.id,
      kind: "business",
      legalName: customer.name,
      roles: ["buyer", "customer"],
      taxIdentifiers: customer.tin ? [{ scheme: "tin", value: customer.tin, issuingCountryCode: "MY" }] : [],
      registrationIdentifiers: [{ scheme: "brn", value: "NA", issuingCountryCode: "MY" }],
      ...(customer.email ? { email: customer.email } : {}),
      billingAddress: {
        addressLines: ["Address pending review"],
        city: "City pending review",
        stateCode: "17",
        countryCode: "MY",
      },
      createdAt: now,
      updatedAt: now,
    })),
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
  const { mode } = useAuth();
  const business = useBusiness().data ?? null;
  const today = useMemo(() => new Date(now), [now]);
  const due = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14), [today]);
  const [parties, setParties] = useState<Party[]>(() => mode === "demo" ? initialParties() : []);
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
  useEffect(() => {
    if (mode !== "supabase" || !business?.id) return;
    let active = true;
    void listSupabaseParties(business.id)
      .then((values) => {
        if (!active) return;
        setParties(values);
        if (values[0]) setValue("buyerId", values[0].id, { shouldValidate: true });
      })
      .catch((error: unknown) => {
        if (active) setBuyerError(error instanceof Error ? error.message : "Customers could not be loaded.");
      });
    return () => { active = false; };
  }, [business?.id, mode, setValue]);
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
  const sourceBusiness = business ?? DEMO_BUSINESS;
  const businessInput = businessOnboardingViewModelSchema.safeParse({
    legalName: sourceBusiness.legalName || sourceBusiness.name,
    tradingName: sourceBusiness.tradingName || sourceBusiness.name,
    businessType: sourceBusiness.type,
    entityType: sourceBusiness.entityType || "sole_proprietorship",
    preferredLanguage: sourceBusiness.preferredLanguage,
    registrationScheme: sourceBusiness.registrationScheme || "brn",
    registrationNumber: sourceBusiness.registrationNumber || "",
    tin: sourceBusiness.tin || "",
    sstRegistration: sourceBusiness.sstRegistration || "",
    msicCode: sourceBusiness.msicCode || "",
    businessActivityDescription: sourceBusiness.businessActivityDescription || "",
    addressLine1: sourceBusiness.addressLine1 || "",
    addressLine2: sourceBusiness.addressLine2 || "",
    city: sourceBusiness.city || "",
    postcode: sourceBusiness.postcode || "",
    stateCode: sourceBusiness.stateCode || "17",
    countryCode: sourceBusiness.countryCode || "MY",
    email: sourceBusiness.email || "",
    phone: sourceBusiness.phone || "",
  });
  let complianceBusiness;
  try {
    complianceBusiness = businessInput.success
      ? businessOnboardingToDomain(businessInput.data, {
        id: sourceBusiness.id,
        now,
        createdAt: sourceBusiness.createdAt,
      })
      : undefined;
  } catch {
    complianceBusiness = undefined;
  }
  const draftInput = {
    documentType: watched.documentType || "invoice",
    invoiceNumber: watched.invoiceNumber || "",
    issueDate: watched.issueDate || "",
    issueTime: watched.issueTime || "09:00",
    dueDate: watched.dueDate || "",
    buyerId: watched.buyerId || "",
    originalDocumentReference: watched.originalDocumentReference || "",
    paymentModeCode: watched.paymentModeCode || "03",
    bankAccountIdentifier: watched.bankAccountIdentifier || "",
    paymentTerms: watched.paymentTerms || "",
    notes: watched.notes || "",
    lines: (watched.items ?? []).map((item, index) => ({
      id: item?.id || fields[index]?.id || `item_${index}`,
      description: item?.description || "",
      quantity: String(item?.quantity ?? ""),
      unitPrice: String(item?.unitPrice ?? ""),
      classificationCode: item?.classificationCode || "",
      unitCode: item?.unitCode || "",
      taxTypeCode: item?.taxTypeCode || "",
      taxRate: String(item?.taxRate ?? ""),
      exemptionReason: item?.exemptionReason || "",
      discountAmount: String(item?.discountAmount ?? ""),
      chargeAmount: String(item?.chargeAmount ?? ""),
    })),
  };
  let preparationResult;
  try {
    const document = invoiceBuilderToDomain(draftInput, {
      id: `document_check_${now.replace(/\W/g, "")}`,
      businessId: sourceBusiness.id,
      supplierPartyId: `party_${sourceBusiness.id}`,
      now,
    });
    preparationResult = createInvoicePreparationResult({
      document,
      business: complianceBusiness,
      buyer: selectedBuyer,
      now,
    });
  } catch {
    preparationResult = undefined;
  }
  const recordIssues = preparationResult?.allIssues.filter((issue) => issue.category !== "myinvois") ?? [];
  const eInvoiceIssues = preparationResult?.allIssues.filter((issue) => issue.category === "myinvois") ?? [];

  const focusField = (fieldPath: string) => {
    const input = document.querySelector<HTMLElement>(`[name="${fieldPath}"]`);
    input?.closest("details")?.setAttribute("open", "");
    input?.focus();
    input?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  const fixPreparationIssue = (fieldPath: string | undefined) => {
    if (!fieldPath) return router.push("/onboarding");
    focusField(fieldPath);
  };

  const createBuyer = async () => {
    setBuyerError("");
    try {
      const prepared = partyEditorToDomain(buyerDraft, { id: `party_${Date.now()}`, now: new Date().toISOString() });
      const activeBusinessId = business?.id ?? (mode === "demo" ? DEMO_BUSINESS.id : "");
      if (!activeBusinessId) throw new Error("Your business workspace is still loading.");
      const party = mode === "supabase" ? await createSupabaseParty(activeBusinessId, prepared) : prepared;
      const next = [...parties.filter((existing) => existing.id !== party.id), party];
      setParties(next);
      if (mode === "demo") browserStorage.set(FRONTEND_STORAGE_KEYS.parties, next);
      setValue("buyerId", party.id, { shouldValidate: true });
      setShowBuyerEditor(false);
      setBuyerDraft(emptyBuyer);
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : "Buyer could not be created.");
    }
  };

  const submit = async (values: ValidInvoiceFormValues) => {
    const activeBusinessId = business?.id ?? (mode === "demo" ? DEMO_BUSINESS.id : "");
    if (!activeBusinessId) return setError("root", { message: "Your business workspace is still loading." });
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
        businessId: activeBusinessId,
        supplierPartyId: `party_${activeBusinessId}`,
        now: new Date().toISOString(),
      });
      const saved = await createInvoice.mutateAsync({
        businessId: activeBusinessId,
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
      if (mode === "demo") {
        const existing = browserStorage.get<CommercialDocument[]>(FRONTEND_STORAGE_KEYS.documents, []);
        browserStorage.set(FRONTEND_STORAGE_KEYS.parties, parties);
        browserStorage.set(FRONTEND_STORAGE_KEYS.documents, [domain, ...existing.filter((document) => document.id !== domain.id)]);
      }
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
        <section className="readiness-card panel" aria-labelledby="readiness-heading"><p className="section-kicker">7 · Preparation checks</p><h2 id="readiness-heading">e-Invoice preparation</h2>
          <div className="preparation-status-list" aria-label="Preparation status">
            <div><span>Owner approval</span><strong>Pending</strong></div>
            <div><span>Niaga record checks</span><strong>{preparationResult ? (recordIssues.length ? "Needs attention" : "Passed") : "Waiting for details"}</strong></div>
            <div><span>e-Invoice preparation</span><strong>{preparationResult ? (eInvoiceIssues.length ? `${eInvoiceIssues.length} to fix` : "Niaga checks passed") : "Waiting for details"}</strong></div>
            <div><span>MyInvois status</span><strong>Not submitted</strong></div>
          </div>
          {!preparationResult ? <p className="readiness-prerequisite">Complete the required invoice fields to run Niaga checks.</p> : null}
          {preparationResult && !preparationResult.allIssues.length ? <div className="preparation-pass"><ShieldCheck aria-hidden="true" size={18} /><div><strong>Niaga checks passed</strong><span>No issues found by the current internal rules.</span></div></div> : null}
          {preparationResult?.allIssues.length ? <ul className="preparation-issue-list">{preparationResult.allIssues.map((issue) => {
            const target = invoicePreparationFieldTarget(issue);
            return <li className={`preparation-issue ${issue.severity}`} key={`${issue.ruleId}-${issue.fieldPath}`}>
              {issue.severity === "error" ? <AlertCircle aria-hidden="true" size={17} /> : <Circle aria-hidden="true" size={16} />}
              <div><strong>Niaga check</strong><p>{issue.message}</p><small>Why it matters: this field supports an accurate record and e-Invoice preparation.</small><small>Reference: {issue.sourceReferenceLabel}</small>
                <button onClick={() => fixPreparationIssue(target)} type="button">{invoicePreparationFixLabel(issue)}</button>
              </div>
            </li>;
          })}</ul> : null}
          <p className="readiness-disclosure"><strong>MyInvois status: Not submitted.</strong> These are Niaga’s internal preparation checks, not official MyInvois validation.</p>
        </section>
      </aside>
    </form>
  </>;
}
