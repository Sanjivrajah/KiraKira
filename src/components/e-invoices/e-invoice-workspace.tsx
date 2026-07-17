"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileCheck2, Info, LockKeyhole, RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { EInvoicePreparationStatus, EInvoicePreparationView, MyInvoisStructuredError, PreparationSupplementalFields } from "@/application/e-invoices";
import { PREPARATION_FIELD_REGISTRY } from "@/application/e-invoices";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { useBusiness } from "@/hooks/use-business";
import { useApproveEInvoice, useCancelEInvoiceDocument, useCreateEInvoiceRevision, useEInvoiceSubmissions, useEInvoiceWorkspace, useGenerateEInvoiceSandboxPayload, usePrepareEInvoices, useRefreshEInvoiceSubmission, useSaveEInvoiceFields, useSubmitEInvoices } from "@/hooks/use-e-invoices";

type View = EInvoicePreparationStatus | "submitted";
const views: Array<{ key: View; label: string }> = [
  { key: "needs_information", label: "Needs information" },
  { key: "ready", label: "Ready for approval" },
  { key: "approved", label: "Approved" },
  { key: "submitted", label: "Submission history" },
];
const emptyFields: PreparationSupplementalFields = {};

function fieldsFrom(record: EInvoicePreparationView): PreparationSupplementalFields {
  return Object.fromEntries(PREPARATION_FIELD_REGISTRY.flatMap((field) => {
    const value = record.supplementalFields[field.key];
    return typeof value === "string" ? [[field.key, value]] : [];
  })) as PreparationSupplementalFields;
}

function fixTarget(record: EInvoicePreparationView, fieldPath: string) {
  if (fieldPath.startsWith("supplier.") || fieldPath.startsWith("business.")) return { href: "/settings#business-profile", label: "Update business details" };
  if (fieldPath.startsWith("buyer.")) return { href: `/invoices/${record.sourceInvoiceId}/edit`, label: "Edit required customer fields" };
  if (fieldPath === "document.issueTime") return { href: "#preparation-field-documentOnlyIssueTime", label: "Enter issue time here" };
  if (fieldPath === "document.exchangeRate") return { href: "#preparation-field-exchangeRate", label: "Enter exchange rate here" };
  return { href: `/invoices/${record.sourceInvoiceId}/edit`, label: "Edit required invoice fields" };
}

function nestedProviderErrors(error: MyInvoisStructuredError): MyInvoisStructuredError[] {
  const legacyDetails = (error as MyInvoisStructuredError & { details?: MyInvoisStructuredError[] }).details;
  const children = error.innerErrors ?? legacyDetails ?? [];
  return children.flatMap((child) => [child, ...nestedProviderErrors(child)]);
}

export function EInvoiceWorkspace() {
  const { mode } = useAuth();
  const business = useBusiness();
  const businessId = business.data?.id ?? "";
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const workspace = useEInvoiceWorkspace(businessId, mode === "supabase");
  const submissionWorkspace = useEInvoiceSubmissions(businessId, environment, mode === "supabase");
  const prepare = usePrepareEInvoices();
  const saveFields = useSaveEInvoiceFields();
  const approve = useApproveEInvoice();
  const createRevision = useCreateEInvoiceRevision();
  const submit = useSubmitEInvoices();
  const generateSandboxPayload = useGenerateEInvoiceSandboxPayload();
  const refreshSubmission = useRefreshEInvoiceSubmission();
  const cancelDocument = useCancelEInvoiceDocument();
  const [view, setView] = useState<View>("needs_information");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedPayloads, setSelectedPayloads] = useState<string[]>([]);
  const [selectedPreparationId, setSelectedPreparationId] = useState("");
  const [draftFields, setDraftFields] = useState<PreparationSupplementalFields>(emptyFields);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const preparations = workspace.data?.preparations ?? [];
  const visiblePreparations = view === "submitted" ? [] : preparations.filter((record) => record.active && record.status === view);
  const selectedPreparation = visiblePreparations.find((record) => record.id === selectedPreparationId) ?? visiblePreparations[0];
  const candidatesById = useMemo(() => new Map((workspace.data?.candidates ?? []).map((candidate) => [candidate.id, candidate])), [workspace.data?.candidates]);
  const submissionCandidates = submissionWorkspace.data?.candidates ?? [];
  const selectedEncodedSize = submissionCandidates.filter((candidate) => selectedPayloads.includes(candidate.payloadSnapshotId)).reduce((sum, candidate) => sum + candidate.encodedSizeBytes, 0);

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
  const submitSelected = async () => {
    setError(""); setMessage("");
    try {
      const { result } = await submit.mutateAsync({
        businessId,
        environment,
        payloadSnapshotIds: selectedPayloads,
        confirmation: environment === "production" ? "SUBMIT TO MYINVOIS PRODUCTION" : undefined,
      });
      if (result.status === "failed" || result.status === "dead_letter") {
        throw new Error(result.errorMessage ?? "MyInvois did not accept this submission.");
      }
      if (!result.submissionUid) {
        throw new Error("MyInvois has not acknowledged this submission. Check Submission history before trying again.");
      }
      setSelectedPayloads([]);
      setView("submitted");
      setMessage(`MyInvois acknowledged submission ${result.submissionUid}. Official validation is still processing.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The submission could not be completed.");
    }
  };

  if (mode === "demo") return <><PageHeader eyebrow="Compliance preparation" title="e-Invoices" description="Complete and approve e-Invoice preparation records separately from invoice payment tracking." /><section className="panel einvoice-demo"><LockKeyhole aria-hidden="true" /><div><h2>Supabase workspace required</h2><p>This browser-only demo does not simulate e-Invoice approvals or submissions. Sign in to a configured Supabase workspace to prepare persisted invoices.</p></div></section></>;
  if (business.isPending || workspace.isPending) return <LoadingState label="Loading e-Invoice preparation workspace" />;
  if (business.isError || workspace.isError) return <><ErrorState title="We could not load e-Invoice preparations" description="No records were changed. Check your connection and try again." /><button className="button button-secondary" onClick={() => { void workspace.refetch(); }} type="button">Try again</button></>;

  const counts = workspace.data?.counts;
  return <>
    <PageHeader eyebrow="Compliance preparation" title="e-Invoices" description="Prepare and approve immutable revisions, then submit unsigned MyInvois v1.0 payloads in the explicitly selected environment and reconcile their official status." />
    {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}</div> : null}
    {error ? <div className="form-alert" role="alert">{error}</div> : null}
    <section aria-label="Preparation summary" className="einvoice-summary">
      <div><span>Selected</span><strong>{selectedSources.length}</strong></div><div><span>Needs information</span><strong>{counts?.needsInformation ?? 0}</strong></div><div><span>Ready</span><strong>{counts?.ready ?? 0}</strong></div><div><span>Approved</span><strong>{counts?.approved ?? 0}</strong></div>
    </section>

    <section aria-labelledby="submission-heading" className="panel einvoice-submission-panel">
      <div className="einvoice-environment-banner"><strong>{environment === "sandbox" ? "Sandbox environment" : "Production environment"}</strong><span>{environment === "sandbox" ? "Use this environment to complete the activation checklist." : submissionWorkspace.data?.productionReady ? "Production v1.0 submission is explicitly activated." : "Production is disabled until the operational gate is complete."}</span><select aria-label="MyInvois environment" onChange={(event) => { setEnvironment(event.target.value as "sandbox" | "production"); setSelectedPayloads([]); }} value={environment}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></div>
      {submissionWorkspace.isPending ? <p role="status">Loading MyInvois submission status…</p> : submissionWorkspace.isError ? <div className="form-alert" role="alert"><span>Submission controls are temporarily unavailable. Your preparation records are still available below.</span><button className="button button-secondary" onClick={() => { void submissionWorkspace.refetch(); }} type="button">Retry submissions</button></div> : <>
      <div className="einvoice-section-heading"><div><h2 id="submission-heading">MyInvois v1.0 payloads ready for submission</h2><p>Unsigned Invoice v1.0 is the only active payload contract. Represented taxpayer: <strong>{submissionWorkspace.data?.taxpayerIdentity ?? "not configured"}</strong>.</p></div><button className="button button-primary" disabled={!selectedPayloads.length || submit.isPending || !submissionWorkspace.data?.taxpayerIdentity || (environment === "production" && !submissionWorkspace.data?.productionReady)} onClick={() => {
        const taxpayer = submissionWorkspace.data?.taxpayerIdentity ?? "the configured taxpayer";
        if (!window.confirm(`Submit ${selectedPayloads.length} unsigned v1.0 document${selectedPayloads.length === 1 ? "" : "s"} (${new Intl.NumberFormat("en-MY").format(selectedEncodedSize)} encoded bytes) to MyInvois ${environment} on behalf of ${taxpayer}?`)) return;
        void submitSelected();
      }} type="button"><Send aria-hidden="true" size={17} />{submit.isPending ? "Submitting…" : `Submit to ${environment}`}</button></div>
      <div className="einvoice-submission-metrics"><span>{selectedPayloads.length} selected</span><span>{new Intl.NumberFormat("en-MY").format(selectedEncodedSize)} encoded bytes</span></div>
      {submissionCandidates.length ? <div className="einvoice-candidate-list">{submissionCandidates.map((candidate) => { const productionEligible = environment !== "production" || candidate.productionEligible; return <label className={`einvoice-candidate ${productionEligible ? "" : "is-ineligible"}`} key={candidate.payloadSnapshotId}><input checked={selectedPayloads.includes(candidate.payloadSnapshotId)} disabled={!productionEligible} onChange={(event) => setSelectedPayloads((current) => event.target.checked ? [...current, candidate.payloadSnapshotId] : current.filter((id) => id !== candidate.payloadSnapshotId))} type="checkbox" /><span><strong>{candidate.invoiceCodeNumber}</strong><small>Approved unsigned v1.0 snapshot · {new Intl.NumberFormat("en-MY").format(candidate.encodedSizeBytes)} encoded bytes</small>{!productionEligible && candidate.ineligibilityReason ? <em>{candidate.ineligibilityReason}</em> : null}</span></label>; })}</div> : <p className="einvoice-submission-empty">No approved v1.0 payloads are available. Open an approved preparation below and prepare its payload.</p>}
      </>}
    </section>

    <section className="panel einvoice-candidates" aria-labelledby="candidate-heading">
      <div className="einvoice-section-heading"><div><h2 id="candidate-heading">Saved invoice candidates</h2><p>Selection begins preparation; it does not mean an invoice is ready to submit.</p></div><button className="button button-primary" disabled={!selectedSources.length || prepare.isPending} onClick={() => run(async () => { await prepare.mutateAsync({ businessId, invoiceIds: selectedSources }); setSelectedSources([]); }, `${selectedSources.length} invoice${selectedSources.length === 1 ? "" : "s"} prepared.`)} type="button">{prepare.isPending ? "Preparing…" : "Prepare selected"}</button></div>
      <div className="einvoice-candidate-list">{workspace.data?.candidates.map((candidate) => <label className={`einvoice-candidate ${candidate.eligible ? "" : "is-ineligible"}`} key={candidate.id}><input checked={selectedSources.includes(candidate.id)} disabled={!candidate.eligible} onChange={(event) => setSelectedSources((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} type="checkbox" /><span><strong>{candidate.invoiceNumber}</strong><small>{candidate.issueDate} · {candidate.currency} · source revision {candidate.revision}</small>{candidate.ineligibilityReasons.map((reason) => <em key={reason}>{reason}</em>)}</span></label>)}</div>
    </section>

    <div className="einvoice-tabs" role="tablist" aria-label="Preparation status">
      {views.map((item) => { const count = item.key === "submitted" ? submissionWorkspace.data?.submissions.length ?? 0 : preparations.filter((record) => record.active && record.status === item.key).length; return <button aria-label={`${item.label} ${count}`} aria-selected={view === item.key} key={item.key} onClick={() => changeView(item.key)} role="tab" type="button">{item.label}<span>{count}</span></button>; })}
    </div>

    {view === "submitted" ? (submissionWorkspace.data?.submissions.length ? <section aria-label={`${environment} submissions`} className="einvoice-submission-list">{submissionWorkspace.data.submissions.map((submission) => <article className="panel einvoice-submission-card" key={submission.id}><div className="einvoice-section-heading"><div><span className={`einvoice-status ${submission.status}`}>{submission.status.replace("_", " ")}</span><h2>{submission.submissionUid ? `Submission ${submission.submissionUid}` : submission.status === "failed" ? "Rejected before MyInvois acknowledgement" : "Local pending submission"}</h2><p>{new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submission.requestedAt))} · {submission.documents.length} document{submission.documents.length === 1 ? "" : "s"}</p></div>{!["completed", "failed", "dead_letter"].includes(submission.status) ? <button className="button button-secondary" disabled={refreshSubmission.isPending} onClick={() => void run(() => refreshSubmission.mutateAsync({ businessId, submissionId: submission.id }), `${environment} status refreshed.` )} type="button"><RefreshCw aria-hidden="true" size={17} />Refresh status</button> : null}</div>{submission.errorMessage || submission.deadLetterReason ? <div className="form-alert" role="alert">{submission.deadLetterReason ?? submission.errorMessage}{submission.retryAfter ? ` Try again after ${new Intl.DateTimeFormat("en-MY", { timeStyle: "short" }).format(new Date(submission.retryAfter))}.` : ""}</div> : null}<div className="einvoice-submission-documents">{submission.documents.map((document) => <div key={document.eInvoiceDocumentId}><span className={`einvoice-status ${document.status}`}>{document.status}</span><strong>{document.invoiceCodeNumber}</strong>{document.myinvoisUuid ? <small>MyInvois UUID: {document.myinvoisUuid}</small> : null}{document.shareUrl ? <a href={document.shareUrl} rel="noreferrer" target="_blank">Open validation link</a> : null}{document.rejectionError ? <div><small className="is-error">{document.rejectionError.message}</small>{nestedProviderErrors(document.rejectionError).map((detail, index) => <small className="is-error" key={`${detail.errorCode ?? "detail"}-${detail.propertyPath ?? index}`}>{detail.propertyPath ? `${detail.propertyPath}: ` : ""}{detail.message}</small>)}</div> : null}{document.validationResult ? <details><summary>Validation details</summary><pre>{JSON.stringify(document.validationResult, null, 2)}</pre></details> : null}{document.status === "valid" && document.cancellationEligibleUntil && new Date(document.cancellationEligibleUntil) > new Date() ? <button className="button button-secondary" disabled={cancelDocument.isPending} onClick={() => { const reason = window.prompt("Why must this valid MyInvois document be cancelled? (10-300 characters)"); if (reason) void run(() => cancelDocument.mutateAsync({ businessId, submissionId: submission.id, eInvoiceDocumentId: document.eInvoiceDocumentId, reason }), "MyInvois confirmed the cancellation. Immutable history was retained."); }} type="button">Cancel document</button> : null}</div>)}</div></article>)}</section> : <section className="panel einvoice-empty"><FileCheck2 aria-hidden="true" /><h2>No {environment} submissions</h2><p>Approved unsigned v1.0 snapshots will appear above when they are ready for controlled submission.</p></section>) : visiblePreparations.length === 0 ? <section className="panel einvoice-empty"><Info aria-hidden="true" /><h2>No {views.find((item) => item.key === view)?.label.toLowerCase()} records</h2><p>Prepare an eligible saved invoice or choose another status.</p></section> : <div className="einvoice-workspace-grid">
      <section className="einvoice-record-list" aria-label={`${views.find((item) => item.key === view)?.label} preparations`}>{visiblePreparations.map((record) => { const candidate = candidatesById.get(record.sourceInvoiceId); return <button aria-current={selectedPreparation?.id === record.id} className="einvoice-record-card" key={record.id} onClick={() => choosePreparation(record)} type="button"><span className={`einvoice-status ${record.status}`}>{record.status.replace("_", " ")}</span><strong>{candidate?.invoiceNumber ?? "Saved invoice"}</strong><small>Revision {record.revision} · {record.scenario.replaceAll("_", " ")}</small><span>{record.readinessResult.diagnostics.filter((item) => item.severity === "error").length} blockers</span></button>; })}</section>
      {selectedPreparation ? <section className="panel einvoice-editor" aria-labelledby="editor-heading">
        <div className="einvoice-section-heading"><div><span className={`einvoice-status ${selectedPreparation.status}`}>{selectedPreparation.status.replace("_", " ")}</span><h2 id="editor-heading">{candidatesById.get(selectedPreparation.sourceInvoiceId)?.invoiceNumber ?? "Preparation revision"}</h2><p>Internal preparation revision {selectedPreparation.revision}. Payment status remains separate.</p></div></div>

        {selectedPreparation.status !== "approved" ? <form onSubmit={(event) => { event.preventDefault(); void run(() => saveFields.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision, fields: draftFields }), "Preparation fields saved and checks refreshed."); }}>
          <fieldset className="einvoice-fields"><legend>Document-specific information</legend><p>Reusable supplier or buyer corrections belong in their source records. These overrides apply only to this revision.</p>{PREPARATION_FIELD_REGISTRY.filter((field) => field.appliesWhen(selectedPreparation.scenario)).map((field) => <label key={field.key}><span>{field.label}</span><input aria-describedby={`help-${field.key}`} id={`preparation-field-${field.key}`} onChange={(event) => { setDraftFields((current) => ({ ...current, [field.key]: event.target.value })); setDirty(true); }} step={field.inputType === "decimal" ? "any" : undefined} type={field.inputType === "decimal" ? "number" : field.inputType} value={draftFields[field.key] ?? fieldsFrom(selectedPreparation)[field.key] ?? ""} /><small id={`help-${field.key}`}>{field.helpText} · {field.registry.label}</small></label>)}</fieldset>
          <div className="einvoice-actions"><button className="button button-secondary" disabled={!dirty || saveFields.isPending} type="submit">{saveFields.isPending ? "Saving…" : "Save and recheck"}</button>{selectedPreparation.status === "ready" ? <button className="button button-primary" disabled={dirty || approve.isPending} onClick={() => { if (window.confirm("Approve and freeze this revision? Future edits will create a new revision.")) void run(() => approve.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision }), "Preparation approved and frozen."); }} type="button">{approve.isPending ? "Approving…" : "Approve revision"}</button> : null}</div>
        </form> : <div className="einvoice-approved"><LockKeyhole aria-hidden="true" /><div><h3>Frozen approval</h3><p>Approved {selectedPreparation.approvedAt ? new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedPreparation.approvedAt)) : "at the server boundary"}. Editing creates a new revision and removes this revision from later submission eligibility.</p><div className="einvoice-actions"><button className="button button-primary" disabled={generateSandboxPayload.isPending || submissionCandidates.some((candidate) => candidate.eInvoiceDocumentId === selectedPreparation.id)} onClick={() => void run(() => generateSandboxPayload.mutateAsync({ businessId, documentId: selectedPreparation.id }), "Unsigned MyInvois v1.0 payload prepared.")} type="button">{submissionCandidates.some((candidate) => candidate.eInvoiceDocumentId === selectedPreparation.id) ? "v1.0 payload ready" : generateSandboxPayload.isPending ? "Preparing…" : "Prepare v1.0 payload"}</button><button className="button button-secondary" disabled={createRevision.isPending} onClick={() => { if (window.confirm("Create an editable revision from this approved snapshot?")) void run(() => createRevision.mutateAsync({ businessId, documentId: selectedPreparation.id }), "A new editable preparation revision was created."); }} type="button">Create new revision</button></div></div></div>}

        <section className="einvoice-diagnostics" aria-labelledby="diagnostics-heading"><h3 id="diagnostics-heading">NiagaAI internal preparation checks</h3><p>These are internal checks, not official MyInvois validation.</p>{(["supplier", "buyer", "document", "line", "tax", "scenario"] as const).map((group) => { const diagnostics = selectedPreparation.readinessResult.diagnostics.filter((item) => item.group === group); if (!diagnostics.length) return null; return <div key={group}><h4>{group}</h4><ul>{diagnostics.map((diagnostic) => { const target = fixTarget(selectedPreparation, diagnostic.fieldPath); return <li className={`is-${diagnostic.severity}`} key={`${diagnostic.code}-${diagnostic.fieldPath}`}><span>{diagnostic.severity === "error" ? <AlertTriangle aria-hidden="true" size={17} /> : <Info aria-hidden="true" size={17} />}</span><div><strong>{diagnostic.message}</strong><small>{diagnostic.sourceReferenceLabel}</small>{diagnostic.severity === "error" ? <Link href={target.href}>{target.label}</Link> : null}</div></li>; })}</ul></div>; })}</section>
      </section> : null}
    </div>}
  </>;
}
