"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCreateTransaction } from "@/hooks/use-transactions";
import type { ReceiptExtraction } from "@/lib/openai/receipt-schema";
import { useBusiness } from "@/hooks/use-business";
import { useAuth } from "@/components/auth/auth-provider";
import type { ValidTransactionFormValues } from "@/lib/validation/transaction";
import type { Transaction, TransactionSourceType } from "@/types";
import { DemoSourceInput } from "./demo-source-input";
import { InputMethodSelector } from "./input-method-selector";
import { ProcessingState } from "./processing-state";
import { ReceiptUploader, type ReceiptBatchResult } from "./receipt-uploader";
import { TransactionReviewForm, type TransactionDraft } from "./transaction-review-form";
import { TransactionSuccessState } from "./transaction-success-state";
import { VoiceRecorderDemo } from "./voice-recorder-demo";

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
      return { ...common, type: "expense", amount: 240, category: "Inventory", description: "20 boxes of mineral water", counterpartyName: "ABC Supplier", paymentMethod: "Bank transfer" };
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

export function TransactionCaptureFlow({ initialMethod }: { initialMethod?: TransactionSourceType }) {
  const createTransaction = useCreateTransaction();
  const businessId = useBusiness().data?.id || "business_demo";
  const userId = useAuth().session?.user.id || "user_demo";
  const [source, setSource] = useState<TransactionSourceType | null>(initialMethod ?? null);
  const [stage, setStage] = useState<Stage>(initialMethod === "manual" ? "review" : initialMethod ? "input" : "select");
  const [draft, setDraft] = useState<TransactionDraft>(() => makeDraft(initialMethod ?? "manual"));
  const [saved, setSaved] = useState<Transaction | null>(null);
  const [saveError, setSaveError] = useState("");
  const [receiptExtractions, setReceiptExtractions] = useState<ReceiptExtraction[]>([]);
  const [receiptIndex, setReceiptIndex] = useState(0);
  const [batchFailureCount, setBatchFailureCount] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stage]);

  const selectSource = (nextSource: TransactionSourceType) => {
    setSource(nextSource);
    setDraft(makeDraft(nextSource));
    setSaveError("");
    setStage(nextSource === "manual" ? "review" : "input");
  };

  const restart = () => {
    setSource(null);
    setSaved(null);
    setSaveError("");
    setReceiptExtractions([]);
    setReceiptIndex(0);
    setBatchFailureCount(0);
    setStage("select");
  };

  const makeReceiptDraft = (extraction: ReceiptExtraction): TransactionDraft => {
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
    };
  };

  const reviewReceiptExtractions = ({ extractions, failures }: ReceiptBatchResult) => {
    setReceiptExtractions(extractions);
    setReceiptIndex(0);
    setBatchFailureCount(failures.length);
    setDraft(makeReceiptDraft(extractions[0]));
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

  const confirm = async (values: ValidTransactionFormValues) => {
    setSaveError("");
    try {
      const transaction = await createTransaction.mutateAsync({
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
      });
      setSaved(transaction);
      setStage("success");
    } catch {
      setSaveError("We couldn’t save to browser storage. Check that local storage is available, then try again.");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Money in and money out"
        title="Add a transaction"
        description={source && stage !== "select" ? `${sourceLabels[source]} · local demo capture` : "Choose the quickest way to record this sale or expense."}
        action={<Link className="button button-secondary" href="/dashboard"><ArrowLeft aria-hidden="true" size={18} />Dashboard</Link>}
      />

      <div className="capture-demo-banner"><LockKeyhole aria-hidden="true" size={17} /><span>{source === "receipt" ? <><strong>AI extraction:</strong> receipt images are sent securely to OpenAI and remain drafts until you confirm them.</> : <><strong>Frontend demo:</strong> non-receipt extraction results are representative and stored on this device.</>}</span></div>

      <div className="capture-workspace">
        {stage === "select" ? <InputMethodSelector onSelect={selectSource} /> : null}
        {stage === "input" && source === "receipt" ? <ReceiptUploader onBack={restart} onExtracted={reviewReceiptExtractions} /> : null}
        {stage === "input" && source === "voice" ? <VoiceRecorderDemo onBack={restart} onContinue={() => setStage("processing")} /> : null}
        {stage === "input" && (source === "csv" || source === "bank_statement" || source === "whatsapp") ? <DemoSourceInput onBack={restart} onContinue={() => setStage("processing")} source={source} /> : null}
        {stage === "processing" ? <ProcessingState onCancel={restart} onComplete={() => setStage("review")} /> : null}
        {stage === "review" ? <TransactionReviewForm batchNotice={batchFailureCount ? `${batchFailureCount} receipt${batchFailureCount === 1 ? "" : "s"} could not be extracted.` : undefined} batchProgress={source === "receipt" && receiptExtractions.length > 1 ? { current: receiptIndex + 1, total: receiptExtractions.length } : undefined} draft={draft} onBack={restart} onConfirm={confirm} saveError={saveError} saving={createTransaction.isPending} /> : null}
        {stage === "success" && saved ? <TransactionSuccessState onAddAnother={restart} onNextReceipt={reviewNextReceipt} remainingReceipts={Math.max(0, receiptExtractions.length - receiptIndex - 1)} transaction={saved} /> : null}
      </div>
    </>
  );
}
