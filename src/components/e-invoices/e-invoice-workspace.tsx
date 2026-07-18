"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, ClipboardList, FileCheck2, History, Info, LockKeyhole, RefreshCw, Send } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EInvoicePreparationStatus, EInvoicePreparationView, EInvoiceSubmissionHistoryFilter, EInvoiceSubmissionRecord, MyInvoisStructuredError, PreparationSupplementalFields } from "@/application/e-invoices";
import { EINVOICE_STAGES, EINVOICE_VIEWS } from "@/components/voice/voice-navigation";
import { useVoiceUiCommand } from "@/components/voice/voice-ui-bus";
import { PREPARATION_FIELD_REGISTRY } from "@/application/e-invoices";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { useBusiness } from "@/hooks/use-business";
import { useApproveEInvoice, useCancelEInvoiceDocument, useCreateEInvoiceRevision, useEInvoiceSubmissionHistory, useEInvoiceSubmissions, useEInvoiceWorkspace, useGenerateEInvoiceSandboxPayload, usePrepareEInvoices, useRefreshEInvoiceSubmission, useSaveEInvoiceFields, useSubmitEInvoices } from "@/hooks/use-e-invoices";

type Stage = "prepare" | "submit" | "history";
const stages: Array<{ key: Stage; label: string; hint: string }> = [
  { key: "prepare", label: "Prepare", hint: "Complete required fields and approve immutable revisions." },
  { key: "submit", label: "Submit", hint: "Send approved unsigned v1.0 payloads in a chosen environment." },
  { key: "history", label: "History", hint: "Reconcile official MyInvois status and keep an audit trail." },
];
const stageIcons: Record<Stage, typeof ClipboardList> = { prepare: ClipboardList, submit: Send, history: History };

const preparationViews: Array<{ key: EInvoicePreparationStatus; label: string }> = [
  { key: "needs_information", label: "Needs information" },
  { key: "ready", label: "Ready for approval" },
  { key: "approved", label: "Approved" },
];
const emptyFields: PreparationSupplementalFields = {};
const DISCARD_PREPARATION_PROMPT = "Discard the unsaved changes to this preparation revision?";

function paramStage(value: string | null): Stage {
  return (EINVOICE_STAGES as readonly string[]).includes(value ?? "") ? (value as Stage) : "prepare";
}
function paramView(value: string | null): EInvoicePreparationStatus {
  return (EINVOICE_VIEWS as readonly string[]).includes(value ?? "") ? (value as EInvoicePreparationStatus) : "needs_information";
}

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
  const [historyFilter, setHistoryFilter] = useState<EInvoiceSubmissionHistoryFilter>("all");
  const submissionWorkspace = useEInvoiceSubmissions(businessId, environment, historyFilter, mode === "supabase");
  const submissionHistory = useEInvoiceSubmissionHistory(businessId, environment, historyFilter, mode === "supabase");
  const prepare = usePrepareEInvoices();
  const saveFields = useSaveEInvoiceFields();
  const approve = useApproveEInvoice();
  const createRevision = useCreateEInvoiceRevision();
  const submit = useSubmitEInvoices();
  const generateSandboxPayload = useGenerateEInvoiceSandboxPayload();
  const refreshSubmission = useRefreshEInvoiceSubmission();
  const cancelDocument = useCancelEInvoiceDocument();
  // Stage and preparation view are reflected in the URL (?stage=&view=) so they
  // are shareable, bookmarkable, and reachable by the voice agent's `navigate`
  // tool. Local state drives rendering; inbound URL changes (e.g. from voice)
  // sync into it, and interactions push back out to the URL.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlStage = paramStage(searchParams.get("stage"));
  const urlView = paramView(searchParams.get("view"));
  const [stage, setStageState] = useState<Stage>(urlStage);
  const [view, setViewState] = useState<EInvoicePreparationStatus>(urlView);
  // Adopt inbound URL changes (e.g. the voice agent's `navigate`) during render
  // rather than in an effect — this is the React-sanctioned way to reset state
  // from a changing source and avoids an extra commit.
  const [syncedLocation, setSyncedLocation] = useState({ stage: urlStage, view: urlView });
  if (syncedLocation.stage !== urlStage || syncedLocation.view !== urlView) {
    setSyncedLocation({ stage: urlStage, view: urlView });
    setStageState(urlStage);
    setViewState(urlView);
  }
  const applyLocation = useCallback((next: { stage?: Stage; view?: EInvoicePreparationStatus }) => {
    if (next.stage !== undefined) setStageState(next.stage);
    if (next.view !== undefined) setViewState(next.view);
    const params = new URLSearchParams(searchParams.toString());
    if (next.stage !== undefined) params.set("stage", next.stage);
    if (next.view !== undefined) params.set("view", next.view);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
  const setStage = useCallback((next: Stage) => applyLocation({ stage: next }), [applyLocation]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedPayloads, setSelectedPayloads] = useState<string[]>([]);
  const [selectedPreparationId, setSelectedPreparationId] = useState("");
  const [draftFields, setDraftFields] = useState<PreparationSupplementalFields>(emptyFields);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attentionOpen, setAttentionOpen] = useState(false);

  const preparations = workspace.data?.preparations ?? [];
  const visiblePreparations = preparations.filter((record) => record.active && record.status === view);
  const selectedPreparation = visiblePreparations.find((record) => record.id === selectedPreparationId) ?? visiblePreparations[0];
  const candidatesById = useMemo(() => new Map((workspace.data?.candidates ?? []).map((candidate) => [candidate.id, candidate])), [workspace.data?.candidates]);
  const submissionCandidates = submissionWorkspace.data?.candidates ?? [];
  const selectedEncodedSize = submissionCandidates.filter((candidate) => selectedPayloads.includes(candidate.payloadSnapshotId)).reduce((sum, candidate) => sum + candidate.encodedSizeBytes, 0);

  const changeHistoryFilter = (next: EInvoiceSubmissionHistoryFilter) => {
    setHistoryFilter(next);
  };

  const choosePreparation = (record: EInvoicePreparationView) => {
    if (dirty && !window.confirm(DISCARD_PREPARATION_PROMPT)) return;
    setSelectedPreparationId(record.id);
    setDraftFields(fieldsFrom(record));
    setDirty(false);
    setError("");
  };
  const changeView = (next: EInvoicePreparationStatus) => {
    if (dirty && !window.confirm(DISCARD_PREPARATION_PROMPT)) return;
    applyLocation({ view: next });
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
      setMessage(`MyInvois acknowledged submission ${result.submissionUid}. Official validation is still processing.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The submission could not be completed.");
    }
  };

  // ── Voice agent in-page actions ──────────────────────────────────────────
  // Each handler returns `false` while its data is still loading so the command
  // stays queued and retries once the workspace has hydrated (see voice-ui-bus).
  useVoiceUiCommand("einvoice.selectAllReady", () => {
    if (submissionWorkspace.isPending) return false;
    applyLocation({ stage: "submit" });
    setSelectedPayloads(
      submissionCandidates
        .filter((candidate) => environment !== "production" || candidate.productionEligible)
        .map((candidate) => candidate.payloadSnapshotId),
    );
  }, [submissionWorkspace.isPending, submissionCandidates, environment, applyLocation]);

  useVoiceUiCommand("einvoice.fillField", (command) => {
    if (workspace.isPending) return false;
    const wanted = command.label.toLowerCase();
    const field = PREPARATION_FIELD_REGISTRY.find(
      (candidate) => candidate.label.toLowerCase().includes(wanted) || candidate.key.toLowerCase() === wanted,
    );
    if (!field || !selectedPreparation || selectedPreparation.status === "approved") return;
    applyLocation({ stage: "prepare" });
    const nextFields = { ...fieldsFrom(selectedPreparation), ...draftFields, [field.key]: command.value };
    setDraftFields(nextFields);
    void run(
      () => saveFields.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision, fields: nextFields }),
      "Preparation fields saved and checks refreshed.",
    );
  }, [workspace.isPending, selectedPreparation, draftFields, businessId]);

  useVoiceUiCommand("einvoice.approve", () => {
    if (workspace.isPending) return false;
    if (!selectedPreparation || selectedPreparation.status !== "ready") return;
    void run(
      () => approve.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision }),
      "Preparation approved and frozen.",
    );
  }, [workspace.isPending, selectedPreparation, businessId]);

  useVoiceUiCommand("einvoice.submit", () => {
    if (submissionWorkspace.isPending) return false;
    if (!selectedPayloads.length) return;
    applyLocation({ stage: "submit" });
    void submitSelected();
  }, [submissionWorkspace.isPending, selectedPayloads]);

  if (mode === "demo") return <><PageHeader eyebrow="Compliance preparation" title="e-Invoices" description="Complete and approve e-Invoice preparation records separately from invoice payment tracking." /><section className="panel einvoice-demo"><LockKeyhole aria-hidden="true" /><div><h2>Supabase workspace required</h2><p>This browser-only demo does not simulate e-Invoice approvals or submissions. Sign in to a configured Supabase workspace to prepare persisted invoices.</p></div></section></>;
  if (business.isPending || workspace.isPending) return <LoadingState label="Loading e-Invoice preparation workspace" />;
  if (business.isError || workspace.isError) return <><ErrorState title="We could not load e-Invoice preparations" description="No records were changed. Check your connection and try again." /><button className="button button-secondary" onClick={() => { void workspace.refetch(); }} type="button">Try again</button></>;

  const counts = workspace.data?.counts;
  const activePreparations = preparations.filter((record) => record.active);
  const eligibleCandidates = workspace.data?.candidates.filter((candidate) => candidate.eligible) ?? [];
  const ineligibleCandidates = workspace.data?.candidates.filter((candidate) => !candidate.eligible) ?? [];
  const attention = submissionWorkspace.data?.attention ?? [];
  const environmentSubmissions = submissionWorkspace.data?.submissions ?? [];
  const historyEntries: EInvoiceSubmissionRecord[] = submissionHistory.data?.pages.flatMap((page) => page.submissions) ?? [];
  const stageCounts: Record<Stage, number> = { prepare: activePreparations.length, submit: submissionCandidates.length, history: environmentSubmissions.length };

  const openPreparation = (documentId: string) => {
    const record = preparations.find((item) => item.id === documentId);
    if (!record) { setError("This submission is retained in history, but its preparation revision is no longer active."); return; }
    applyLocation({ stage: "prepare", view: record.status });
    setSelectedPreparationId(record.id);
    setDraftFields(fieldsFrom(record));
    setError("");
  };
  const goToBlockers = () => {
    if (dirty && !window.confirm(DISCARD_PREPARATION_PROMPT)) return;
    applyLocation({ stage: "prepare", view: "needs_information" });
    setSelectedPreparationId("");
    setDraftFields(emptyFields);
    setDirty(false);
  };

  return <>
    <PageHeader eyebrow="Compliance preparation" title="e-Invoices" description="Prepare and approve immutable revisions, then submit unsigned MyInvois v1.0 payloads in the explicitly selected environment and reconcile their official status." />
    {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}</div> : null}
    {error ? <div className="form-alert" role="alert">{error}</div> : null}

    <section aria-label="e-Invoice overview" className="einvoice-summary einvoice-queue-summary">
      <button onClick={() => { setAttentionOpen(true); window.requestAnimationFrame(() => document.getElementById("needs-attention")?.scrollIntoView({ behavior: "smooth" })); }} type="button"><span>Needs attention</span><strong>{submissionWorkspace.data?.summary.needsAttention ?? attention.length}</strong></button>
      <button onClick={() => setStage("submit")} type="button"><span>Ready to submit</span><strong>{submissionWorkspace.data?.summary.readyToSubmit ?? submissionCandidates.length}</strong></button>
      <button onClick={() => { setStage("history"); changeHistoryFilter("in_progress"); }} type="button"><span>In progress</span><strong>{submissionWorkspace.data?.summary.inProgress ?? 0}</strong></button>
      <button onClick={goToBlockers} type="button"><span>Preparation blockers</span><strong>{counts?.needsInformation ?? 0}</strong></button>
    </section>

    <nav aria-label="e-Invoice workflow" className="einvoice-stage-nav" role="tablist">
      {stages.map((item) => { const Icon = stageIcons[item.key]; const count = stageCounts[item.key]; const showAlert = item.key === "history" && attention.length > 0; return <button aria-controls="einvoice-stage-panel" aria-selected={stage === item.key} id={`einvoice-tab-${item.key}`} key={item.key} onClick={() => setStage(item.key)} role="tab" type="button"><Icon aria-hidden="true" size={18} /><span className="einvoice-stage-label">{item.label}</span>{showAlert ? <span className="einvoice-stage-count is-alert">{attention.length}<span className="sr-only"> needing attention</span></span> : count ? <span className="einvoice-stage-count">{count}</span> : null}</button>; })}
    </nav>
    <p className="einvoice-stage-hint">{stages.find((item) => item.key === stage)?.hint}</p>

    <div aria-labelledby={`einvoice-tab-${stage}`} className="einvoice-stage" id="einvoice-stage-panel" role="tabpanel" tabIndex={-1}>
      {stage === "prepare" ? <>
        <section className="panel einvoice-candidates" aria-labelledby="candidate-heading">
          <div className="einvoice-section-heading"><div><h2 id="candidate-heading">Saved invoice candidates</h2><p>Selection begins preparation; it does not mean an invoice is ready to submit.</p><p aria-live="polite">{selectedSources.length} selected for preparation</p></div><button className="button button-primary" disabled={!selectedSources.length || prepare.isPending} onClick={() => run(async () => { await prepare.mutateAsync({ businessId, invoiceIds: selectedSources }); setSelectedSources([]); }, `${selectedSources.length} invoice${selectedSources.length === 1 ? "" : "s"} prepared.`)} type="button">{prepare.isPending ? "Preparing…" : "Prepare selected"}</button></div>
          {eligibleCandidates.length ? <div className="einvoice-candidate-list">{eligibleCandidates.map((candidate) => <label className="einvoice-candidate" key={candidate.id}><input checked={selectedSources.includes(candidate.id)} onChange={(event) => setSelectedSources((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} type="checkbox" /><span><strong>{candidate.invoiceNumber}</strong><small>{candidate.issueDate} · {candidate.currency} · source revision {candidate.revision}</small></span></label>)}</div> : <p className="einvoice-submission-empty">No saved invoices are ready to begin preparation.</p>}
          {ineligibleCandidates.length ? <details className="einvoice-ineligible"><summary>Not ready to prepare ({ineligibleCandidates.length}) <ChevronDown aria-hidden="true" size={16} /></summary><div>{ineligibleCandidates.map((candidate) => <article key={candidate.id}><strong>{candidate.invoiceNumber}</strong><small>{candidate.ineligibilityReasons.join(" ")}</small></article>)}</div></details> : null}
        </section>

        <div className="einvoice-tabs" role="tablist" aria-label="Preparation status">
          {preparationViews.map((item) => { const count = preparations.filter((record) => record.active && record.status === item.key).length; return <button aria-label={`${item.label} ${count}`} aria-selected={view === item.key} key={item.key} onClick={() => changeView(item.key)} role="tab" type="button">{item.label}<span>{count}</span></button>; })}
        </div>

        {visiblePreparations.length === 0 ? <section className="panel einvoice-empty"><Info aria-hidden="true" /><h2>No {preparationViews.find((item) => item.key === view)?.label.toLowerCase()} records</h2><p>Prepare an eligible saved invoice or choose another status.</p></section> : <div className="einvoice-workspace-grid">
          <section className="einvoice-record-list" aria-label={`${preparationViews.find((item) => item.key === view)?.label} preparations`}>{visiblePreparations.map((record) => { const candidate = candidatesById.get(record.sourceInvoiceId); return <button aria-current={selectedPreparation?.id === record.id} className="einvoice-record-card" key={record.id} onClick={() => choosePreparation(record)} type="button"><span className={`einvoice-status ${record.status}`}>{record.status.replace("_", " ")}</span><strong>{candidate?.invoiceNumber ?? "Saved invoice"}</strong><small>Revision {record.revision} · {record.scenario.replaceAll("_", " ")}</small><span>{record.readinessResult.diagnostics.filter((item) => item.severity === "error").length} blockers</span></button>; })}</section>
          {selectedPreparation ? <section className="panel einvoice-editor" aria-labelledby="editor-heading">
            <div className="einvoice-section-heading"><div><span className={`einvoice-status ${selectedPreparation.status}`}>{selectedPreparation.status.replace("_", " ")}</span><h2 id="editor-heading">{candidatesById.get(selectedPreparation.sourceInvoiceId)?.invoiceNumber ?? "Preparation revision"}</h2><p>Internal preparation revision {selectedPreparation.revision}. Payment status remains separate.</p></div></div>

            {selectedPreparation.status !== "approved" ? <form onSubmit={(event) => { event.preventDefault(); void run(() => saveFields.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision, fields: draftFields }), "Preparation fields saved and checks refreshed."); }}>
              <fieldset className="einvoice-fields"><legend>Document-specific information</legend><p>Reusable supplier or buyer corrections belong in their source records. These overrides apply only to this revision.</p>{PREPARATION_FIELD_REGISTRY.filter((field) => field.appliesWhen(selectedPreparation.scenario)).map((field) => <label key={field.key}><span>{field.label}</span><input aria-describedby={`help-${field.key}`} id={`preparation-field-${field.key}`} onChange={(event) => { setDraftFields((current) => ({ ...current, [field.key]: event.target.value })); setDirty(true); }} step={field.inputType === "decimal" ? "any" : undefined} type={field.inputType === "decimal" ? "number" : field.inputType} value={draftFields[field.key] ?? fieldsFrom(selectedPreparation)[field.key] ?? ""} /><small id={`help-${field.key}`}>{field.helpText} · {field.registry.label}</small></label>)}</fieldset>
              <div className="einvoice-actions"><button className="button button-secondary" disabled={!dirty || saveFields.isPending} type="submit">{saveFields.isPending ? "Saving…" : "Save and recheck"}</button>{selectedPreparation.status === "ready" ? <button className="button button-primary" disabled={dirty || approve.isPending} onClick={() => { if (window.confirm("Approve and freeze this revision? Future edits will create a new revision.")) void run(() => approve.mutateAsync({ businessId, documentId: selectedPreparation.id, expectedRevision: selectedPreparation.revision }), "Preparation approved and frozen."); }} type="button">{approve.isPending ? "Approving…" : "Approve revision"}</button> : null}</div>
            </form> : <div className="einvoice-approved"><LockKeyhole aria-hidden="true" /><div><h3>Frozen approval</h3><p>Approved {selectedPreparation.approvedAt ? new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedPreparation.approvedAt)) : "at the server boundary"}. Editing creates a new revision and removes this revision from later submission eligibility.</p><div className="einvoice-actions"><button className="button button-primary" disabled={generateSandboxPayload.isPending || submissionCandidates.some((candidate) => candidate.eInvoiceDocumentId === selectedPreparation.id)} onClick={() => void run(() => generateSandboxPayload.mutateAsync({ businessId, documentId: selectedPreparation.id }), "Unsigned MyInvois v1.0 payload prepared.")} type="button">{submissionCandidates.some((candidate) => candidate.eInvoiceDocumentId === selectedPreparation.id) ? "v1.0 payload ready" : generateSandboxPayload.isPending ? "Preparing…" : "Prepare v1.0 payload"}</button><button className="button button-secondary" disabled={createRevision.isPending} onClick={() => { if (window.confirm("Create an editable revision from this approved snapshot?")) void run(() => createRevision.mutateAsync({ businessId, documentId: selectedPreparation.id }), "A new editable preparation revision was created."); }} type="button">Create new revision</button></div></div></div>}

            <section className="einvoice-diagnostics" aria-labelledby="diagnostics-heading"><h3 id="diagnostics-heading">NiagaAI internal preparation checks</h3><p>These are internal checks, not official MyInvois validation.</p>{(["supplier", "buyer", "document", "line", "tax", "scenario"] as const).map((group) => { const diagnostics = selectedPreparation.readinessResult.diagnostics.filter((item) => item.group === group); if (!diagnostics.length) return null; return <div key={group}><h4>{group}</h4><ul>{diagnostics.map((diagnostic) => { const target = fixTarget(selectedPreparation, diagnostic.fieldPath); return <li className={`is-${diagnostic.severity}`} key={`${diagnostic.code}-${diagnostic.fieldPath}`}><span>{diagnostic.severity === "error" ? <AlertTriangle aria-hidden="true" size={17} /> : <Info aria-hidden="true" size={17} />}</span><div><strong>{diagnostic.message}</strong><small>{diagnostic.sourceReferenceLabel}</small>{diagnostic.severity === "error" ? <Link href={target.href}>{target.label}</Link> : null}</div></li>; })}</ul></div>; })}</section>
          </section> : null}
        </div>}
      </> : null}

      {stage === "submit" ? <>
        <section aria-labelledby="submission-heading" className="panel einvoice-submission-panel">
          <div className="einvoice-environment-banner"><div><strong>{environment === "sandbox" ? "Sandbox" : "Production"}</strong><span>{environment === "sandbox" ? "Controlled activation environment" : submissionWorkspace.data?.productionReady ? "Production v1.0 submission is activated" : "Production is disabled"}</span></div><select aria-label="MyInvois environment" onChange={(event) => { setEnvironment(event.target.value as "sandbox" | "production"); setSelectedPayloads([]); }} value={environment}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></div>
          {submissionWorkspace.isPending ? <p role="status">Loading MyInvois submission status…</p> : submissionWorkspace.isError ? <div className="form-alert" role="alert"><span>Submission controls are temporarily unavailable. Your preparation records are still available in the Prepare stage.</span><button className="button button-secondary" onClick={() => { void submissionWorkspace.refetch(); }} type="button">Retry submissions</button></div> : <>
          <div className="einvoice-section-heading" id="ready-to-submit"><div><h2 id="submission-heading">Ready to submit</h2><p>Unsigned Invoice v1.0 payloads only · represented taxpayer: <strong>{submissionWorkspace.data?.taxpayerIdentity ?? "not configured"}</strong>.</p></div><button className="button button-primary" disabled={!selectedPayloads.length || submit.isPending || !submissionWorkspace.data?.taxpayerIdentity || (environment === "production" && !submissionWorkspace.data?.productionReady)} onClick={() => {
            const taxpayer = submissionWorkspace.data?.taxpayerIdentity ?? "the configured taxpayer";
            if (!window.confirm(`Submit ${selectedPayloads.length} unsigned v1.0 document${selectedPayloads.length === 1 ? "" : "s"} (${new Intl.NumberFormat("en-MY").format(selectedEncodedSize)} encoded bytes) to MyInvois ${environment} on behalf of ${taxpayer}?`)) return;
            void submitSelected();
          }} type="button"><Send aria-hidden="true" size={17} />{submit.isPending ? "Submitting…" : `Submit to ${environment}`}</button></div>
          <div className="einvoice-submission-metrics"><span>{selectedPayloads.length} selected</span><span>{new Intl.NumberFormat("en-MY").format(selectedEncodedSize)} encoded bytes</span></div>
          {submissionCandidates.length ? <div className="einvoice-candidate-list">{submissionCandidates.map((candidate) => { const productionEligible = environment !== "production" || candidate.productionEligible; return <label className={`einvoice-candidate ${productionEligible ? "" : "is-ineligible"}`} key={candidate.payloadSnapshotId}><input checked={selectedPayloads.includes(candidate.payloadSnapshotId)} disabled={!productionEligible} onChange={(event) => setSelectedPayloads((current) => event.target.checked ? [...current, candidate.payloadSnapshotId] : current.filter((id) => id !== candidate.payloadSnapshotId))} type="checkbox" /><span><strong>{candidate.invoiceCodeNumber}</strong><small>Approved unsigned v1.0 snapshot · {new Intl.NumberFormat("en-MY").format(candidate.encodedSizeBytes)} encoded bytes</small>{!productionEligible && candidate.ineligibilityReason ? <em>{candidate.ineligibilityReason}</em> : null}</span></label>; })}</div> : <p className="einvoice-submission-empty">No approved v1.0 payloads are available. Open an approved preparation in the Prepare stage and prepare its payload.</p>}
          </>}
        </section>

        {submissionWorkspace.data ? environmentSubmissions.length ? <section aria-label={`${environment} submissions`} className="einvoice-submission-list">{environmentSubmissions.map((submission) => <article className="panel einvoice-submission-card" key={submission.id}><div className="einvoice-section-heading"><div><span className={`einvoice-status ${submission.status}`}>{submission.status.replace("_", " ")}</span><h2>{submission.submissionUid ? `Submission ${submission.submissionUid}` : submission.status === "failed" ? "Rejected before MyInvois acknowledgement" : "Local pending submission"}</h2><p>{new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submission.requestedAt))} · {submission.documents.length} document{submission.documents.length === 1 ? "" : "s"}</p></div>{!["completed", "failed", "dead_letter"].includes(submission.status) ? <button className="button button-secondary" disabled={refreshSubmission.isPending} onClick={() => void run(() => refreshSubmission.mutateAsync({ businessId, submissionId: submission.id }), `${environment} status refreshed.` )} type="button"><RefreshCw aria-hidden="true" size={17} />Refresh status</button> : null}</div>{submission.errorMessage || submission.deadLetterReason ? <div className="form-alert" role="alert">{submission.deadLetterReason ?? submission.errorMessage}{submission.retryAfter ? ` Try again after ${new Intl.DateTimeFormat("en-MY", { timeStyle: "short" }).format(new Date(submission.retryAfter))}.` : ""}</div> : null}<div className="einvoice-submission-documents">{submission.documents.map((document) => <div key={document.eInvoiceDocumentId}><span className={`einvoice-status ${document.status}`}>{document.status}</span><strong>{document.invoiceCodeNumber}</strong>{document.myinvoisUuid ? <small>MyInvois UUID: {document.myinvoisUuid}</small> : null}{document.shareUrl ? <a href={document.shareUrl} rel="noreferrer" target="_blank">Open validation link</a> : null}{document.rejectionError ? <div><small className="is-error">{document.rejectionError.message}</small>{nestedProviderErrors(document.rejectionError).map((detail, index) => <small className="is-error" key={`${detail.errorCode ?? "detail"}-${detail.propertyPath ?? index}`}>{detail.propertyPath ? `${detail.propertyPath}: ` : ""}{detail.message}</small>)}</div> : null}{document.validationResult ? <details><summary>Validation details</summary><pre>{JSON.stringify(document.validationResult, null, 2)}</pre></details> : null}{document.status === "valid" && document.cancellationEligibleUntil && new Date(document.cancellationEligibleUntil) > new Date() ? <button className="button button-secondary" disabled={cancelDocument.isPending} onClick={() => { const reason = window.prompt("Why must this valid MyInvois document be cancelled? (10-300 characters)"); if (reason) void run(() => cancelDocument.mutateAsync({ businessId, submissionId: submission.id, eInvoiceDocumentId: document.eInvoiceDocumentId, reason }), "MyInvois confirmed the cancellation. Immutable history was retained."); }} type="button">Cancel document</button> : null}</div>)}</div></article>)}</section> : <section className="panel einvoice-empty"><FileCheck2 aria-hidden="true" /><h2>No {environment} submissions</h2><p>Approved unsigned v1.0 snapshots appear above when they are ready for controlled submission.</p></section> : null}
      </> : null}

      {stage === "history" ? <section className="panel einvoice-history" aria-labelledby="history-heading"><div className="einvoice-section-heading"><div><h2 id="history-heading">Submission history</h2><p>Compact audit history. A submitted document is still awaiting official MyInvois validation.</p></div><div className="einvoice-history-filters" aria-label="Submission history filters">{(["all", "attention", "in_progress", "completed"] as const).map((filter) => <button aria-pressed={historyFilter === filter} key={filter} onClick={() => changeHistoryFilter(filter)} type="button">{filter.replace("_", " ")}</button>)}</div></div>{historyEntries.length ? <div className="einvoice-history-list" aria-live="polite">{historyEntries.map((submission) => <details key={submission.id}><summary><span className={`einvoice-status ${submission.status}`}>{submission.status.replace("_", " ")}</span><strong>{submission.submissionUid ? `Submission ${submission.submissionUid}` : submission.status === "failed" ? "Rejected before acknowledgement" : "Local submission"}</strong><small>{new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submission.requestedAt))} · {submission.documents.length} document{submission.documents.length === 1 ? "" : "s"}</small><ChevronDown aria-hidden="true" size={17} /></summary><div className="einvoice-history-detail">{submission.errorMessage || submission.deadLetterReason ? <p className="is-error">{submission.deadLetterReason ?? submission.errorMessage}</p> : null}{submission.documents.map((document) => <div key={document.eInvoiceDocumentId}><span className={`einvoice-status ${document.status}`}>{document.status}</span><strong>{document.invoiceCodeNumber}</strong>{document.myinvoisUuid ? <small>MyInvois UUID: {document.myinvoisUuid}</small> : null}{document.shareUrl ? <a href={document.shareUrl} rel="noreferrer" target="_blank">Open validation link</a> : null}{document.rejectionError ? <small className="is-error">{document.rejectionError.message}</small> : null}{document.status === "valid" && document.cancellationEligibleUntil && new Date(document.cancellationEligibleUntil) > new Date() ? <button className="button button-secondary" disabled={cancelDocument.isPending} onClick={() => { const reason = window.prompt("Why must this valid MyInvois document be cancelled? (10-300 characters)"); if (reason) void run(() => cancelDocument.mutateAsync({ businessId, submissionId: submission.id, eInvoiceDocumentId: document.eInvoiceDocumentId, reason }), "MyInvois confirmed the cancellation. Immutable history was retained."); }} type="button">Cancel document</button> : null}</div>)}</div></details>)}</div> : <p className="einvoice-submission-empty">No submissions match this filter.</p>}{submissionHistory.hasNextPage ? <button className="button button-secondary" disabled={submissionHistory.isFetchingNextPage} onClick={() => void submissionHistory.fetchNextPage()} type="button">{submissionHistory.isFetchingNextPage ? "Loading…" : "Load more"}</button> : null}</section> : null}
    </div>

    {attention.length ? <details className="panel einvoice-attention" id="needs-attention" onToggle={(event) => setAttentionOpen(event.currentTarget.open)} open={attentionOpen}><summary><span><CircleAlert aria-hidden="true" size={20} />Needs attention</span><strong>{attention.length}</strong><ChevronDown aria-hidden="true" size={18} /></summary><div className="einvoice-attention-content"><div className="einvoice-section-heading"><div><h2 id="attention-heading">Needs attention</h2><p>These documents cannot be resubmitted unchanged. Review the reason, then create or update a preparation revision.</p></div></div><div className="einvoice-attention-list">{attention.flatMap((submission) => submission.documents.map((document) => <article key={`${submission.id}-${document.eInvoiceDocumentId}`}><div><span className={`einvoice-status ${document.status}`}>{document.status}</span><strong>{document.invoiceCodeNumber}</strong><small>{new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submission.requestedAt))}</small></div><p>{document.rejectionError?.message ?? submission.deadLetterReason ?? submission.errorMessage ?? "MyInvois needs this document to be reviewed before a new revision is submitted."}</p><div className="einvoice-row-actions"><button className="button button-secondary" onClick={() => openPreparation(document.eInvoiceDocumentId)} type="button">Open preparation</button>{document.rejectionError || document.validationResult ? <details><summary>View details <ChevronDown aria-hidden="true" size={15} /></summary>{document.rejectionError ? <div className="einvoice-error-details"><small>{document.rejectionError.message}</small>{nestedProviderErrors(document.rejectionError).map((detail, index) => <small key={`${detail.errorCode ?? "detail"}-${index}`}>{detail.propertyPath ? `${detail.propertyPath}: ` : ""}{detail.message}</small>)}</div> : <pre>{JSON.stringify(document.validationResult, null, 2)}</pre>}</details> : null}</div></article>))}</div></div></details> : null}
  </>;
}
