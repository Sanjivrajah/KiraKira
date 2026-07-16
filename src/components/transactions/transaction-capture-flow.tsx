"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCreateTransaction, useTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import type { ReceiptExtraction } from "@/lib/openai/receipt-schema";
import { useBusiness } from "@/hooks/use-business";
import { useAuth } from "@/components/auth/auth-provider";
import type { ValidTransactionFormValues } from "@/lib/validation/transaction";
import type { Transaction, TransactionSourceType } from "@/types";
import { DemoSourceInput, type TransactionFileImportResult } from "./demo-source-input";
import { InputMethodSelector } from "./input-method-selector";
import { ProcessingState } from "./processing-state";
import { ReceiptUploader, type ReceiptBatchResult } from "./receipt-uploader";
import { TransactionReviewForm, type TransactionDraft, type TransactionReviewHints } from "./transaction-review-form";
import { TransactionSuccessState } from "./transaction-success-state";
import { VoiceRecorder, type VoiceTransactionResult } from "./voice-recorder";
import { DEMO_BUSINESS, DEMO_USER } from "@/data/demo";
import {
  DEMO_REVIEW_RECEIPT_EXTRACTION,
  DEMO_REVIEW_EXTRACTION_RUN,
  DEMO_REVIEW_RECEIPT_TEXT,
  DEMO_REVIEW_SOURCE_DOCUMENT,
} from "@/data/demo/demo-review-receipt";
import { persistReviewProvenance } from "@/frontend/storage";
import {
  approveExtractionRun,
  deriveApprovalAuditTimeline,
  transactionReviewToDomain,
  type ApprovalAuditEvent,
} from "@/frontend/view-models";
import { isoDateTimeSchema, type ExtractionRun, type SourceDocument } from "@/domain";

type Stage = "select" | "input" | "processing" | "review" | "success";

const sourceLabels: Record<TransactionSourceType, string> = {
  receipt: "Receipt photo",
  voice: "Voice note",
  manual: "Manual entry",
  csv: "CSV import",
  bank_statement: "Bank statement",
  whatsapp: "WhatsApp order",
};

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function makeDraft(source: TransactionSourceType): TransactionDraft {
  const common = { date: localDate(), source };
  switch (source) {
    case "receipt":
      return { ...common, type: "expense", amount: 86.4, category: "Inventory", description: "Cooking ingredients and packaging", counterpartyName: "Maju Mart", paymentMethod: "Debit card" };
    case "voice":
      return { ...common, date: "", type: "expense", amount: undefined, category: "Uncategorised", description: "", counterpartyName: "", paymentMethod: "" };
    case "csv":
      return { ...common, type: "expense", amount: 78, category: "Utilities", description: "Mobile and internet bill", counterpartyName: "CelcomDigi", paymentMethod: "Auto debit" };
    case "bank_statement":
      return { ...common, type: "income", amount: 620, category: "Sales", description: "Office lunch order", counterpartyName: "Teras Digital", paymentMethod: "Bank transfer" };
    case "whatsapp":
      return { ...common, type: "income", amount: 850, category: "Catering", description: "Catering deposit for 40 lunch boxes", counterpartyName: "Suria Events", paymentMethod: "Bank transfer" };
    case "manual":
      return { ...common, type: "income", amount: undefined, category: "", description: "", counterpartyName: "", paymentMethod: "" };
  }
}

function makeReceiptDraft(extraction: ReceiptExtraction): TransactionDraft {
  const descriptions = extraction.lineItems.map((item) => item.description).filter(Boolean);
  return {
    type: "expense",
    date: extraction.documentDate.value || localDate(),
    amount: extraction.total.value ?? undefined,
    category: extraction.category.value || "Uncategorised",
    description: descriptions.join(", ").slice(0, 160) || `Receipt from ${extraction.merchantName.value || "unknown merchant"}`,
    counterpartyName: extraction.merchantName.value || "",
    paymentMethod: extraction.paymentMethod.value || "",
    source: "receipt",
    eInvoiceTreatment: "self_billed_candidate",
    fieldConfidence: {
      amount: extraction.total.confidence,
      merchant: extraction.merchantName.confidence,
      date: extraction.documentDate.confidence,
      category: extraction.category.confidence,
    },
  };
}

export function TransactionCaptureFlow({ initialMethod, demoScenario, reviewTransactionId }: {
  initialMethod?: TransactionSourceType;
  demoScenario?: "ambiguous-receipt";
  reviewTransactionId?: string;
}) {
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const businessId = useBusiness().data?.id || DEMO_BUSINESS.id;
  const reviewedTransaction = useTransaction(businessId, reviewTransactionId);
  const userId = useAuth().session?.user.id || DEMO_USER.id;
  const [source, setSource] = useState<TransactionSourceType | null>(initialMethod ?? null);
  const [stage, setStage] = useState<Stage>(demoScenario ? "review" : initialMethod === "manual" ? "review" : initialMethod ? "input" : "select");
  const [draft, setDraft] = useState<TransactionDraft>(() => demoScenario
    ? makeReceiptDraft(DEMO_REVIEW_RECEIPT_EXTRACTION)
    : makeDraft(initialMethod ?? "manual"));
  const [saved, setSaved] = useState<Transaction | null>(null);
  const [saveError, setSaveError] = useState("");
  const [receiptExtractions, setReceiptExtractions] = useState<ReceiptExtraction[]>([]);
  const [receiptIndex, setReceiptIndex] = useState(0);
  const [importDrafts, setImportDrafts] = useState<TransactionDraft[]>([]);
  const [importIndex, setImportIndex] = useState(0);
  const [batchNotice, setBatchNotice] = useState("");
  const [reviewDisclosure, setReviewDisclosure] = useState<{ title: string; description: string } | undefined>(demoScenario ? {
    title: "Prepared from your receipt.",
    description: "Compare the prepared draft with the evidence before approving.",
  } : undefined);
  const [sourceEvidence, setSourceEvidence] = useState<{ label: string; text: string } | undefined>(demoScenario ? {
    label: "Receipt text",
    text: DEMO_REVIEW_RECEIPT_TEXT,
  } : undefined);
  const [reviewHints, setReviewHints] = useState<TransactionReviewHints>(demoScenario ? {
    amount: "The prepared amount differs from the receipt total. Check the printed TOTAL and correct this field.",
  } : {});
  const [activeProvenance, setActiveProvenance] = useState<{
    sourceDocument: SourceDocument;
    extractionRun: ExtractionRun;
  } | null>(demoScenario ? {
    sourceDocument: DEMO_REVIEW_SOURCE_DOCUMENT,
    extractionRun: DEMO_REVIEW_EXTRACTION_RUN,
  } : null);
  const [approvalTimeline, setApprovalTimeline] = useState<ApprovalAuditEvent[]>([]);

  const sourceNotice = source === null
    ? <><strong>Private by default:</strong> choose an evidence source to see how it will be handled before anything is saved.</>
    : source === "receipt"
    ? <><strong>Receipt review:</strong> we prepare a draft from each image. Nothing is saved until you approve it.</>
    : source === "csv"
      ? <><strong>Spreadsheet import:</strong> rows are prepared on this device and remain drafts until you approve them.</>
      : source === "voice"
        ? <><strong>Voice review:</strong> we prepare a draft from your recording. Nothing is saved until you approve it.</>
        : source === "bank_statement"
          ? <><strong>Statement import:</strong> we prepare transactions for you to check before saving.</>
          : source === "whatsapp"
            ? <><strong>Message review:</strong> this demo turns an order message into a draft for you to check.</>
            : <><strong>Private by default:</strong> your manual entry stays in this browser until you save it.</>;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stage]);

  const selectSource = (nextSource: TransactionSourceType) => {
    setSource(nextSource);
    setDraft(makeDraft(nextSource));
    setSaveError("");
    setBatchNotice("");
    setSourceEvidence(undefined);
    setReviewHints({});
    setActiveProvenance(null);
    setApprovalTimeline([]);
    setReviewDisclosure(nextSource === "whatsapp" ? {
      title: "Sample extraction",
      description: "This is representative demo data. No AI service processed your input.",
    } : undefined);
    setStage(nextSource === "manual" ? "review" : "input");
  };

  const restart = () => {
    setSource(null);
    setSaved(null);
    setSaveError("");
    setReceiptExtractions([]);
    setReceiptIndex(0);
    setImportDrafts([]);
    setImportIndex(0);
    setBatchNotice("");
    setReviewDisclosure(undefined);
    setSourceEvidence(undefined);
    setReviewHints({});
    setActiveProvenance(null);
    setApprovalTimeline([]);
    setStage("select");
  };

  const reviewReceiptExtractions = ({ extractions, failures }: ReceiptBatchResult) => {
    setReceiptExtractions(extractions);
    setReceiptIndex(0);
    setImportDrafts([]);
    setBatchNotice(failures.length ? `${failures.length} receipt${failures.length === 1 ? "" : "s"} could not be extracted. You can upload them again after this batch.` : "");
    setReviewDisclosure({ title: "Prepared from your receipt.", description: "We read the image and created this draft. Compare it with the receipt before approving." });
    const first = extractions[0];
    const printedTotal = first.total.evidenceText;
    const preparedTotal = first.total.value;
    const totalNeedsCheck = Boolean(
      printedTotal && preparedTotal !== null &&
      !printedTotal.includes(preparedTotal.toFixed(2)),
    );
    setSourceEvidence({
      label: "Receipt text",
      text: first === DEMO_REVIEW_RECEIPT_EXTRACTION
        ? DEMO_REVIEW_RECEIPT_TEXT
        : [
            first.merchantName.evidenceText,
            ...first.lineItems.map((item) => item.evidenceText),
            first.subtotal.evidenceText,
            first.tax.evidenceText,
            first.total.evidenceText,
          ].filter(Boolean).join("\n"),
    });
    setReviewHints(totalNeedsCheck ? {
      amount: "The prepared amount differs from the receipt total. Check the printed TOTAL and correct this field.",
    } : {});
    setActiveProvenance(first === DEMO_REVIEW_RECEIPT_EXTRACTION ? {
      sourceDocument: DEMO_REVIEW_SOURCE_DOCUMENT,
      extractionRun: DEMO_REVIEW_EXTRACTION_RUN,
    } : null);
    setDraft(makeReceiptDraft(extractions[0]));
    setStage("review");
  };

  const reviewImportedTransactions = ({ drafts, failures, warnings, method }: TransactionFileImportResult) => {
    setImportDrafts(drafts);
    setImportIndex(0);
    setReceiptExtractions([]);
    setReceiptIndex(0);
    const notices = [
      failures.length ? `${failures.length} CSV row${failures.length === 1 ? " was" : "s were"} skipped because required values were missing or invalid.` : "",
      ...warnings.slice(0, 2),
    ].filter(Boolean);
    setBatchNotice(notices.join(" "));
    setReviewDisclosure(method === "openai_pdf"
      ? { title: "Prepared from your bank statement.", description: "We read the PDF and created these drafts. Compare each one with the statement before approving." }
      : { title: "Prepared on this device.", description: "We matched the spreadsheet columns without uploading the file. Check each transaction before approving." });
    setSourceEvidence(undefined);
    setReviewHints({});
    setActiveProvenance(null);
    setDraft(drafts[0]);
    setStage("review");
  };

  const reviewVoiceTransaction = ({ draft: voiceDraft, transcript, warnings }: VoiceTransactionResult) => {
    setReceiptExtractions([]);
    setReceiptIndex(0);
    setImportDrafts([]);
    setImportIndex(0);
    const hints: TransactionReviewHints = {};
    const remainingWarnings: string[] = [];
    for (const warning of warnings) {
      if (/date/i.test(warning)) hints.date = warning;
      else if (/counterparty|merchant|customer|who/i.test(warning)) hints.counterpartyName = warning;
      else if (/amount|currency|ringgit/i.test(warning)) hints.amount = warning;
      else if (/money in|money out|transaction type/i.test(warning)) hints.type = warning;
      else if (/quantity|description|wording/i.test(warning)) hints.description = warning;
      else remainingWarnings.push(warning);
    }
    setBatchNotice(remainingWarnings.slice(0, 2).join(" "));
    setReviewHints(hints);
    setActiveProvenance(null);
    setReviewDisclosure({
      title: "Prepared from your voice note.",
      description: "We converted the recording into a draft. Compare it with what you said before approving.",
    });
    setSourceEvidence({ label: "Voice note transcript", text: transcript });
    setDraft(voiceDraft);
    setStage("review");
  };

  const reviewNextReceipt = () => {
    const nextIndex = receiptIndex + 1;
    if (nextIndex >= receiptExtractions.length) {
      restart();
      return;
    }
    setReceiptIndex(nextIndex);
    setSaved(null);
    setDraft(makeReceiptDraft(receiptExtractions[nextIndex]));
    setStage("review");
  };

  const reviewNextImport = () => {
    const nextIndex = importIndex + 1;
    if (nextIndex >= importDrafts.length) {
      restart();
      return;
    }
    setImportIndex(nextIndex);
    setSaved(null);
    setDraft(importDrafts[nextIndex]);
    setStage("review");
  };

  const confirm = async (values: ValidTransactionFormValues) => {
    setSaveError("");
    if (reviewTransactionId && !reviewedTransaction.data) {
      setSaveError("We couldn’t load this record. Return to Records and open it again.");
      return;
    }
    try {
      const transactionValues = {
        businessId,
        createdBy: userId,
        type: values.type,
        subtotal: values.amount,
        tax: 0,
        total: values.amount,
        currency: "MYR",
        date: values.date,
        category: values.category,
        description: values.description,
        counterpartyName: values.counterpartyName,
        paymentMethod: values.paymentMethod || null,
        sourceType: values.source,
        status: "confirmed",
        items: [],
      } satisfies Omit<Transaction, "id" | "createdAt" | "updatedAt">;
      const transaction = reviewedTransaction.data
        ? await updateTransaction.mutateAsync({
            ...reviewedTransaction.data,
            ...transactionValues,
            sourceDocumentId: reviewedTransaction.data.sourceDocumentId,
          })
        : await createTransaction.mutateAsync(transactionValues);
      const reviewedAt = reviewedTransaction.data ? transaction.updatedAt : transaction.createdAt;
      const approvedRun = activeProvenance
        ? approveExtractionRun(activeProvenance.extractionRun, {
            type: values.type,
            date: values.date,
            amount: values.amount,
            category: values.category,
            description: values.description,
            counterpartyName: values.counterpartyName,
            paymentMethod: values.paymentMethod || "",
          }, { reviewedBy: userId, reviewedAt })
        : undefined;
      const domain = transactionReviewToDomain({
        ...values,
        fieldConfidence: draft.fieldConfidence ?? {},
      }, {
        id: transaction.id,
        businessId,
        userId,
        now: reviewedAt,
        ...(approvedRun ? { extractionRun: approvedRun } : {}),
      });
      if (activeProvenance && approvedRun) {
        persistReviewProvenance(activeProvenance.sourceDocument, approvedRun);
        setApprovalTimeline(deriveApprovalAuditTimeline({
          sourceDocument: activeProvenance.sourceDocument,
          extractionRun: approvedRun,
          transaction: domain,
          checksRerunAt: isoDateTimeSchema.parse(reviewedAt),
        }));
      }
      setSaved(transaction);
      setStage("success");
    } catch (error) {
      setSaveError(error instanceof Error && error.message
        ? error.message
        : "We couldn’t save this transaction. Please try again.");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Evidence review"
        title="Add evidence"
        description={source && stage !== "select" ? `${sourceLabels[source]} · owner approval required` : "Choose the evidence you already have. Niaga will prepare a record for you to check."}
        action={<Link className="button button-secondary" href="/dashboard"><ArrowLeft aria-hidden="true" size={18} />Evidence inbox</Link>}
      />

      <div className="capture-demo-banner"><LockKeyhole aria-hidden="true" size={17} /><span>{sourceNotice}</span></div>

      <div className="capture-workspace">
        {stage === "select" ? <InputMethodSelector onSelect={selectSource} /> : null}
        {stage === "input" && source === "receipt" ? <ReceiptUploader onBack={restart} onExtracted={reviewReceiptExtractions} /> : null}
        {stage === "input" && source === "voice" ? <VoiceRecorder onBack={restart} onExtracted={reviewVoiceTransaction} /> : null}
        {stage === "input" && (source === "csv" || source === "bank_statement" || source === "whatsapp") ? <DemoSourceInput onBack={restart} onContinue={() => setStage("processing")} onImported={reviewImportedTransactions} source={source} /> : null}
        {stage === "processing" ? <ProcessingState onCancel={restart} onComplete={() => setStage("review")} /> : null}
        {stage === "review" ? <TransactionReviewForm batchNotice={batchNotice || undefined} batchProgress={source === "receipt" && receiptExtractions.length > 1 ? { current: receiptIndex + 1, total: receiptExtractions.length, label: "receipt" } : importDrafts.length > 1 ? { current: importIndex + 1, total: importDrafts.length, label: "transaction" } : undefined} disclosure={reviewDisclosure} draft={draft} onBack={restart} onConfirm={confirm} onReject={restart} reviewHints={reviewHints} saveError={saveError} saving={createTransaction.isPending || updateTransaction.isPending || (Boolean(reviewTransactionId) && reviewedTransaction.isPending)} sourceEvidence={sourceEvidence} /> : null}
        {stage === "success" && saved ? <TransactionSuccessState approvalTimeline={approvalTimeline} onAddAnother={restart} onNextItem={receiptExtractions.length ? reviewNextReceipt : importDrafts.length ? reviewNextImport : undefined} remainingItems={receiptExtractions.length ? Math.max(0, receiptExtractions.length - receiptIndex - 1) : Math.max(0, importDrafts.length - importIndex - 1)} nextItemLabel={receiptExtractions.length ? "receipt" : "transaction"} transaction={saved} /> : null}
      </div>
    </>
  );
}
