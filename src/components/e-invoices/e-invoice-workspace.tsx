"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileCheck2, Info, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import type { EInvoicePreparationStatus, EInvoicePreparationView, PreparationSupplementalFields } from "@/application/e-invoices";
import { PREPARATION_FIELD_REGISTRY } from "@/application/e-invoices";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { useBusiness } from "@/hooks/use-business";
import { useApproveEInvoice, useCreateEInvoiceRevision, useEInvoiceWorkspace, usePrepareEInvoices, useSaveEInvoiceFields } from "@/hooks/use-e-invoices";

type View = EInvoicePreparationStatus | "submitted";
const views: Array<{ key: View; label: string }> = [
  { key: "needs_information", label: "Needs information" },
  { key: "ready", label: "Ready for approval" },
  { key: "approved", label: "Approved" },
  { key: "submitted", label: "Submitted" },
];
const emptyFields: PreparationSupplementalFields = {};

function fieldsFrom(record: EInvoicePreparationView): PreparationSupplementalFields {
  return Object.fromEntries(PREPARATION_FIELD_REGISTRY.flatMap((field) => {
    const value = record.supplementalFields[field.key];
    return typeof value === "string" ? [[field.key, value]] : [];
  })) as PreparationSupplementalFields;
}

function fixTarget(record: EInvoicePreparationView, fieldPath: string) {
  if (fieldPath.startsWith("supplier.") || fieldPath.startsWith("business.")) return { href: "/settings", label: "Update business details" };
  if (fieldPath.startsWith("buyer.")) return { href: `/invoices/${record.sourceInvoiceId}`, label: "Review customer on invoice" };
  return { href: `/invoices/${record.sourceInvoiceId}`, label: "Review source invoice" };
}

export function EInvoiceWorkspace() {
  const { mode } = useAuth();
  const business = useBusiness();
  const businessId = business.data?.id ?? "";
  const workspace = useEInvoiceWorkspace(businessId, mode === "supabase");
  const prepare = usePrepareEInvoices();
  const saveFields = useSaveEInvoiceFields();
  const approve = useApproveEInvoice();
  const createRevision = useCreateEInvoiceRevision();
  const [view, setView] = useState<View>("needs_information");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedPreparationId, setSelectedPreparationId] = useState("");
  const [draftFields, setDraftFields] = useState<PreparationSupplementalFields>(emptyFields);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const preparations = workspace.data?.preparations ?? [];
  const visiblePreparations = view === "submitted" ? [] : preparations.filter((record) => record.active && record.status === view);
  const selectedPreparation = visiblePreparations.find((record) => record.id === selectedPreparationId) ?? visiblePreparations[0];
  const candidatesById = useMemo(() => new Map((workspace.data?.candidates ?? []).map((candidate) => [candidate.id, candidate])), [workspace.data?.candidates]);

  const choosePreparation = (record: EInvoicePreparationView) => {
    if (dirty && !window.confirm("Discard the unsaved changes to this preparation revision?")) return;
    setSelectedPreparationId(record.id);
    setDraftFields(fieldsFrom(record));
    setDirty(false);
    setError("");
  };
  const changeView = (next: View) => {
    if (dirty && !window.confirm("Discard the unsaved changes to this preparation revision?")) return;
    setView(next);
    setSelectedPreparationId("");
    setDraftFields(emptyFields);
    setDirty(false);
  };
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setError(""); setMessage("");
    try { await operation(); setMessage(success); setDirty(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The action could not be completed."); }
  };

  if (mode === "demo") return <><PageHeader eyebrow="Compliance preparation" title="e-Invoices" description="Complete and approve e-Invoice preparation records separately from invoice payment tracking." /><section className="panel einvoice-demo"><LockKeyhole aria-hidden="true" /><div><h2>Supabase workspace required</h2><p>This browser-only demo does not simulate e-Invoice approvals or submissions. Sign in to a configured Supabase workspace to prepare persisted invoices.</p></div></section></>;
  if (business.isPending || workspace.isPending) return <LoadingState label="Loading e-Invoice preparation workspace" />;
  if (business.isError || workspace.isError) return <><ErrorState title="We could not load e-Invoice preparations" description="No records were changed. Check your connection and try again." /><button className="button button-secondary" onClick={() => workspace.refetch()} type="button">Try again</button></>;

  const counts = workspace.data?.counts;
  return <>
    <PageHeader eyebrow="Compliance preparation" title="e-Invoices" description="Resolve missing information, run NiagaAI internal preparation checks, and approve a frozen revision. This workspace does not submit to MyInvois." />
    {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}</div> : null}
    {error ? <div className="form-alert" role="alert">{error}</div> : null}
    <section aria-label="Preparation summary" className="einvoice-summary">
      <div><span>Selected</span><strong>{selectedSources.length}</strong></div><div><span>Needs information</span><strong>{counts?.needsInformation ?? 0}</strong></div><div><span>Ready</span><strong>{counts?.ready ?? 0}</strong></div><div><span>Approved</span><strong>{counts?.approved ?? 0}</strong></div>
    </section>

    <section className="panel einvoice-candidates" aria-labelledby="candidate-heading">
      <div className="einvoice-section-heading"><div><h2 id="candidate-heading">Saved invoice candidates</h2><p>Selection begins preparation; it does not mean an invoice is ready to submit.</p></div><button className="button button-primary" disabled={!selectedSources.length || prepare.isPending} onClick={() => run(async () => { await prepare.mutateAsync({ businessId, invoiceIds: selectedSources }); setSelectedSources([]); }, `${selectedSources.length} invoice${selectedSources.length === 1 ? "" : "s"} prepared.`)} type="button">{prepare.isPending ? "Preparing…" : "Prepare selected"}</button></div>
      <div className="einvoice-candidate-list">{workspace.data?.candidates.map((candidate) => <label className={`einvoice-candidate ${candidate.eligible ? "" : "is-ineligible"}`} key={candidate.id}><input checked={selectedSources.includes(candidate.id)} disabled={!candidate.eligible} onChange={(event) => setSelectedSources((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} type="checkbox" /><span><strong>{candidate.invoiceNumber}</strong><small>{candidate.issueDate} · {candidate.currency} · source revision {candidate.revision}</small>{candidate.ineligibilityReasons.map((reason) => <em key={reason}>{reason}</em>)}</span></label>)}</div>
    </section>

    <div className="einvoice-tabs" role="tablist" aria-label="Preparation status">
      {views.map((item) => <button aria-selected={view === item.key} key={item.key} onClick={() => changeView(item.key)} role="tab" type="button">{item.label}{item.key !== "submitted" ? <span>{preparations.filter((record) => record.active && record.status === item.key).length}</span> : null}</button>)}
    </div>

    {view === "submitted" ? <section className="panel einvoice-empty"><FileCheck2 aria-hidden="true" /><h2>No submitted records</h2><p>Submission is introduced in a later stage. NiagaAI does not simulate MyInvois status here.</p></section> : visiblePreparations.length === 0 ? <section className="panel einvoice-empty"><Info aria-hidden="true" /><h2>No {views.find((item) => item.key === view)?.label.toLowerCase()} records</h2><p>Prepare an eligible saved invoice or choose another status.</p></section> : <div className="einvoice-workspace-grid">
      <section className="einvoice-record-list" aria-label={`${views.find((item) => item.key === view)?.label} preparations`}>{visiblePreparations.map((record) => { const candidate = candidatesById.get(record.sourceInvoiceId); return <button aria-current={selectedPreparation?.id === record.id} className="einvoice-record-card" key={record.id} onClick={() => choosePreparation(record)} type="button"><span className={`einvoice-status ${record.status}`}>{record.status.replace("_", " ")}</span><strong>{candidate?.invoiceNumber ?? "Saved invoice"}</strong><small>Revision {record.revision} · {record.scenario.replaceAll("_", " ")}</small><span>{record.readinessResult.diagnostics.filter((item) => item.severity === "error").length} blockers</span></button>; })}</section>
      {selectedPreparation ? <section className="panel einvoice-editor" aria-labelledby="editor-heading">
        <div className="einvoice-section-heading"><div><span className={`einvoice-status ${selectedPreparation.status}`}>{selectedPreparation.status.replace("_", " ")}</span><h2 id="editor-heading">{candidatesById.get(selectedPreparation.sourceInvoiceId)?.invoiceNumber ?? "Preparation revision"}</h2><p>Internal preparation revision {selectedPreparation.revision}. Payment status remains separate.</p></div></div>

        {selectedPreparation.status !== "approved" ? <form onSubmit={(event) => { event.preventDefault(); void run(() => saveFields.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision, fields: draftFields }), "Preparation fields saved and checks refreshed."); }}>
          <fieldset className="einvoice-fields"><legend>Document-specific information</legend><p>Reusable supplier or buyer corrections belong in their source records. These overrides apply only to this revision.</p>{PREPARATION_FIELD_REGISTRY.filter((field) => field.appliesWhen(selectedPreparation.scenario)).map((field) => <label key={field.key}><span>{field.label}</span><input aria-describedby={`help-${field.key}`} onChange={(event) => { setDraftFields((current) => ({ ...current, [field.key]: event.target.value })); setDirty(true); }} step={field.inputType === "decimal" ? "any" : undefined} type={field.inputType === "decimal" ? "number" : field.inputType} value={draftFields[field.key] ?? fieldsFrom(selectedPreparation)[field.key] ?? ""} /><small id={`help-${field.key}`}>{field.helpText} · {field.registry.label}</small></label>)}</fieldset>
          <div className="einvoice-actions"><button className="button button-secondary" disabled={!dirty || saveFields.isPending} type="submit">{saveFields.isPending ? "Saving…" : "Save and recheck"}</button>{selectedPreparation.status === "ready" ? <button className="button button-primary" disabled={dirty || approve.isPending} onClick={() => { if (window.confirm("Approve and freeze this revision? Future edits will create a new revision.")) void run(() => approve.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision }), "Preparation approved and frozen."); }} type="button">{approve.isPending ? "Approving…" : "Approve revision"}</button> : null}</div>
        </form> : <div className="einvoice-approved"><LockKeyhole aria-hidden="true" /><div><h3>Frozen approval</h3><p>Approved {selectedPreparation.approvedAt ? new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedPreparation.approvedAt)) : "at the server boundary"}. Editing creates a new revision and removes this revision from later submission eligibility.</p><button className="button button-secondary" disabled={createRevision.isPending} onClick={() => { if (window.confirm("Create an editable revision from this approved snapshot?")) void run(() => createRevision.mutateAsync({ businessId, documentId: selectedPreparation.id }), "A new editable preparation revision was created."); }} type="button">Create new revision</button></div></div>}

        <section className="einvoice-diagnostics" aria-labelledby="diagnostics-heading"><h3 id="diagnostics-heading">NiagaAI internal preparation checks</h3><p>These are internal checks, not official MyInvois validation.</p>{(["supplier", "buyer", "document", "line", "tax", "scenario"] as const).map((group) => { const diagnostics = selectedPreparation.readinessResult.diagnostics.filter((item) => item.group === group); if (!diagnostics.length) return null; return <div key={group}><h4>{group}</h4><ul>{diagnostics.map((diagnostic) => { const target = fixTarget(selectedPreparation, diagnostic.fieldPath); return <li className={`is-${diagnostic.severity}`} key={`${diagnostic.code}-${diagnostic.fieldPath}`}><span>{diagnostic.severity === "error" ? <AlertTriangle aria-hidden="true" size={17} /> : <Info aria-hidden="true" size={17} />}</span><div><strong>{diagnostic.message}</strong><small>{diagnostic.sourceReferenceLabel}</small>{diagnostic.severity === "error" ? <Link href={target.href}>{target.label}</Link> : null}</div></li>; })}</ul></div>; })}</section>
      </section> : null}
    </div>}
  </>;
}
