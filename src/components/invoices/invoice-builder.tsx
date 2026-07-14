"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, Circle, Plus, ReceiptText, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { BrandMark } from "@/components/shared/brand-mark";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { calculateInvoiceTotals, getInvoiceReadinessChecks, parseLocalDate } from "@/lib/invoices/calculations";
import { makeInvoiceId, makeInvoiceNumber, saveInvoice } from "@/lib/invoices/storage";
import { invoiceFormSchema, type InvoiceFormValues, type ValidInvoiceFormValues } from "@/lib/validation/invoice";
import { useNiagaStore } from "@/store/use-niaga-store";

const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric" });
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function makeItemId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `item_${crypto.randomUUID()}`;
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function InvoiceBuilder() {
  const router = useRouter();
  const business = useNiagaStore((state) => state.business);
  const today = new Date();
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
  const { control, register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<InvoiceFormValues, unknown, ValidInvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: makeInvoiceNumber(), customerName: "", customerEmail: "", buyerTin: "", issueDate: isoDate(today), dueDate: isoDate(due), status: "draft",
      items: [{ id: makeItemId(), description: "", quantity: 1, unitPrice: 0, taxRate: 0 }], notes: "", paymentTerms: "Payment due within 14 days.",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });
  const items = (watched.items || []).map((item) => ({
    description: item?.description || "", quantity: Number.isFinite(Number(item?.quantity)) ? Number(item?.quantity) : 0,
    unitPrice: Number.isFinite(Number(item?.unitPrice)) ? Number(item?.unitPrice) : 0, taxRate: Number.isFinite(Number(item?.taxRate)) ? Number(item?.taxRate) : 0,
  }));
  const totals = calculateInvoiceTotals(items);
  const readiness = getInvoiceReadinessChecks({ business, customerName: watched.customerName || "", buyerTin: watched.buyerTin || "", issueDate: watched.issueDate || "", items });
  const readyCount = readiness.filter((item) => item.ready).length;

  const submit = (values: ValidInvoiceFormValues) => {
    const calculated = calculateInvoiceTotals(values.items);
    const now = new Date().toISOString();
    const saved = saveInvoice({ ...values, id: makeInvoiceId(), items: values.items.map((item) => ({ ...item, id: item.id || makeItemId() })), ...calculated, createdAt: now, updatedAt: now });
    if (!saved) {
      setError("root", { message: "We could not save this invoice in your browser. Check available storage and try again." });
      return;
    }
    router.push("/invoices?created=1");
  };

  return (
    <>
      <PageHeader eyebrow="Invoice builder" title="Create invoice" description="Build a clear invoice, check the expected details, then save it locally." />
      <form className="invoice-builder-grid" noValidate onSubmit={handleSubmit(submit)}>
        <div className="invoice-form-column">
          <section className="panel invoice-form-section"><div className="invoice-section-heading"><div><p className="section-kicker">Customer and dates</p><h2>Invoice details</h2></div><ReceiptText aria-hidden="true" size={22} /></div><div className="review-form-grid"><FormField error={errors.invoiceNumber?.message} label="Invoice number" maxLength={40} {...register("invoiceNumber")} /><SelectField error={errors.status?.message} label="Starting status" options={[{ label: "Draft", value: "draft" }, { label: "Sent", value: "sent" }]} {...register("status")} /><FormField error={errors.customerName?.message} label="Customer name" maxLength={100} placeholder="e.g. Kedai Murni" {...register("customerName")} /><FormField error={errors.customerEmail?.message} label="Customer email (optional)" maxLength={254} type="email" {...register("customerEmail")} /><FormField error={errors.buyerTin?.message} hint="Optional placeholder for this frontend readiness check." label="Buyer TIN (optional)" maxLength={30} {...register("buyerTin")} /><div /><FormField error={errors.issueDate?.message} label="Issue date" type="date" {...register("issueDate")} /><FormField error={errors.dueDate?.message} label="Due date" min={watched.issueDate || undefined} type="date" {...register("dueDate")} /></div></section>

          <section className="panel invoice-form-section"><div className="invoice-section-heading"><div><p className="section-kicker">What you are charging for</p><h2>Line items</h2></div><button className="button button-secondary compact-button" disabled={fields.length >= 50} onClick={() => append({ id: makeItemId(), description: "", quantity: 1, unitPrice: 0, taxRate: 0 })} type="button"><Plus aria-hidden="true" size={16} />{fields.length >= 50 ? "50 item limit" : "Add item"}</button></div><div className="line-items">{fields.map((field, index) => <fieldset className="line-item" key={field.id}><legend>Item {index + 1}</legend><FormField className="line-description" error={errors.items?.[index]?.description?.message} label="Description" maxLength={140} {...register(`items.${index}.description`)} /><FormField error={errors.items?.[index]?.quantity?.message} inputMode="decimal" label="Quantity" min="0.01" step="0.01" type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} /><FormField error={errors.items?.[index]?.unitPrice?.message} inputMode="decimal" label="Unit price (RM)" min="0" step="0.01" type="number" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} /><FormField error={errors.items?.[index]?.taxRate?.message} inputMode="decimal" label="Tax rate (%)" max="100" min="0" step="0.01" type="number" {...register(`items.${index}.taxRate`, { valueAsNumber: true })} /><input type="hidden" {...register(`items.${index}.id`)} /><button aria-label={`Remove item ${index + 1}`} className="remove-line-item" disabled={fields.length === 1} onClick={() => remove(index)} type="button"><Trash2 aria-hidden="true" size={17} />Remove</button></fieldset>)}</div></section>

          <section className="panel invoice-form-section"><p className="section-kicker">Final details</p><h2>Notes and terms</h2><div className="invoice-notes-grid"><TextareaField error={errors.notes?.message} label="Notes (optional)" maxLength={500} rows={4} {...register("notes")} /><TextareaField error={errors.paymentTerms?.message} label="Payment terms (optional)" maxLength={240} rows={4} {...register("paymentTerms")} /></div></section>
          {errors.root?.message ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} />{errors.root.message}</div> : null}
          <div className="invoice-save-actions"><button className="button button-secondary" onClick={() => router.push("/invoices")} type="button">Cancel</button><button className="button button-primary" disabled={isSubmitting} type="submit"><Save aria-hidden="true" size={18} />Save invoice</button></div>
        </div>

        <aside className="invoice-preview-column">
          <section className="invoice-preview panel" aria-label="Invoice preview"><div className="invoice-preview-brand"><div><BrandMark /><strong>{business?.name || "Your business"}</strong></div><span>Invoice</span></div><div className="invoice-preview-meta"><div><span>Bill to</span><strong>{watched.customerName || "Customer name"}</strong><small>{watched.customerEmail || "Customer email"}</small></div><dl><div><dt>Invoice no.</dt><dd>{watched.invoiceNumber || "—"}</dd></div><div><dt>Issue date</dt><dd>{watched.issueDate ? dateFormatter.format(parseLocalDate(watched.issueDate)) : "—"}</dd></div><div><dt>Due date</dt><dd>{watched.dueDate ? dateFormatter.format(parseLocalDate(watched.dueDate)) : "—"}</dd></div></dl></div><div className="preview-items"><div className="preview-item-row heading"><span>Description</span><span>Amount</span></div>{items.map((item, index) => <div className="preview-item-row" key={fields[index]?.id || index}><span><strong>{item.description || `Item ${index + 1}`}</strong><small>{item.quantity || 0} × RM{item.unitPrice.toFixed(2)} · {item.taxRate}% tax</small></span><MoneyDisplay amount={item.quantity * item.unitPrice} /></div>)}</div><dl className="invoice-totals"><div><dt>Subtotal</dt><dd><MoneyDisplay amount={totals.subtotal} /></dd></div><div><dt>Tax</dt><dd><MoneyDisplay amount={totals.tax} /></dd></div><div className="invoice-total"><dt>Total</dt><dd><MoneyDisplay amount={totals.total} /></dd></div></dl>{watched.paymentTerms ? <p className="preview-terms"><strong>Payment terms</strong>{watched.paymentTerms}</p> : null}</section>
          <section className="readiness-card panel"><div className="readiness-heading"><div><p className="section-kicker">E-invoice readiness</p><h2>{readyCount} of {readiness.length} checks ready</h2></div><span>{Math.round((readyCount / readiness.length) * 100)}%</span></div><ul>{readiness.map((item) => <li key={item.label}>{item.ready ? <Check aria-hidden="true" size={15} /> : <Circle aria-hidden="true" size={14} />}<span>{item.label}</span></li>)}</ul><p className="readiness-disclosure">This is a frontend readiness check only. The invoice has not been submitted to MyInvois.</p></section>
        </aside>
      </form>
    </>
  );
}
