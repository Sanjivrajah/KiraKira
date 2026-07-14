"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { makeTransactionId, saveTransaction } from "@/lib/transactions/storage";
import type { ValidTransactionFormValues } from "@/lib/validation/transaction";
import { useNiagaStore } from "@/store/use-niaga-store";
import type { Transaction, TransactionSourceType } from "@/types";
import { DemoSourceInput } from "./demo-source-input";
import { InputMethodSelector } from "./input-method-selector";
import { ProcessingState } from "./processing-state";
import { ReceiptUploader } from "./receipt-uploader";
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
  const businessId = useNiagaStore((state) => state.business?.id) || "business_demo";
  const userId = useNiagaStore((state) => state.user?.id) || "user_demo";
  const [source, setSource] = useState<TransactionSourceType | null>(initialMethod ?? null);
  const [stage, setStage] = useState<Stage>(initialMethod === "manual" ? "review" : initialMethod ? "input" : "select");
  const [draft, setDraft] = useState<TransactionDraft>(() => makeDraft(initialMethod ?? "manual"));
  const [saved, setSaved] = useState<Transaction | null>(null);
  const [saveError, setSaveError] = useState("");

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
    setStage("select");
  };

  const confirm = (values: ValidTransactionFormValues) => {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: makeTransactionId(),
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
      createdAt: now,
      updatedAt: now,
    };

    if (!saveTransaction(transaction)) {
      setSaveError("We couldn’t save to browser storage. Check that local storage is available, then try again.");
      return;
    }
    setSaved(transaction);
    setStage("success");
  };

  return (
    <>
      <PageHeader
        eyebrow="Money in and money out"
        title="Add a transaction"
        description={source && stage !== "select" ? `${sourceLabels[source]} · local demo capture` : "Choose the quickest way to record this sale or expense."}
        action={<Link className="button button-secondary" href="/dashboard"><ArrowLeft aria-hidden="true" size={18} />Dashboard</Link>}
      />

      <div className="capture-demo-banner"><LockKeyhole aria-hidden="true" size={17} /><span><strong>Frontend demo:</strong> files remain on this device and all extraction results are representative.</span></div>

      <div className="capture-workspace">
        {stage === "select" ? <InputMethodSelector onSelect={selectSource} /> : null}
        {stage === "input" && source === "receipt" ? <ReceiptUploader onBack={restart} onContinue={() => setStage("processing")} /> : null}
        {stage === "input" && source === "voice" ? <VoiceRecorderDemo onBack={restart} onContinue={() => setStage("processing")} /> : null}
        {stage === "input" && (source === "csv" || source === "bank_statement" || source === "whatsapp") ? <DemoSourceInput onBack={restart} onContinue={() => setStage("processing")} source={source} /> : null}
        {stage === "processing" ? <ProcessingState onCancel={restart} onComplete={() => setStage("review")} /> : null}
        {stage === "review" ? <TransactionReviewForm draft={draft} onBack={restart} onConfirm={confirm} saveError={saveError} /> : null}
        {stage === "success" && saved ? <TransactionSuccessState onAddAnother={restart} transaction={saved} /> : null}
      </div>
    </>
  );
}
