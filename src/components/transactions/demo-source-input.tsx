"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Landmark, MessageCircle, UploadCloud } from "lucide-react";
import { TextareaField } from "@/components/forms/textarea-field";
import { DEMO_WHATSAPP_ORDER_MESSAGE } from "@/data/demo";
import { parseTransactionCsv, type ImportedTransactionDraft } from "@/lib/imports/transaction-csv";

const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export interface TransactionFileImportResult {
  drafts: ImportedTransactionDraft[];
  failures: string[];
  warnings: string[];
  method: "local_csv" | "openai_pdf";
}

const sourceCopy = {
  csv: {
    eyebrow: "CSV import",
    title: "Choose a transaction file",
    help: "Select a CSV with dates and amounts. We parse up to 100 rows on this device, then you review each transaction.",
    accept: ".csv,text/csv",
    icon: FileSpreadsheet,
  },
  bank_statement: {
    eyebrow: "Bank statement",
    title: "Choose a bank statement",
    help: "Choose a bank CSV or PDF. We’ll prepare transactions for you to compare with the statement before saving.",
    accept: ".pdf,.csv,application/pdf,text/csv",
    icon: Landmark,
  },
} as const;

export function DemoSourceInput({ source, onContinue, onImported, onBack }: {
  source: "csv" | "bank_statement" | "whatsapp";
  onContinue: () => void;
  onImported: (result: TransactionFileImportResult) => void | Promise<void>;
  onBack: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState(DEMO_WHATSAPP_ORDER_MESSAGE);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async () => {
    if (!file || importing || source === "whatsapp") return;
    if (file.size === 0 || file.size > MAX_IMPORT_BYTES) {
      setError("Choose a file between 1 byte and 15 MB.");
      return;
    }

    setError("");
    setImporting(true);
    try {
      const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
      if (isCsv) {
        const result = parseTransactionCsv(await file.text(), source);
        if (result.drafts.length === 0) throw new Error(result.failures[0] || "No complete transactions were found in this CSV.");
        await onImported({
          drafts: result.drafts,
          failures: result.failures,
          warnings: result.truncated ? ["Only the first 100 rows were imported."] : [],
          method: "local_csv",
        });
        return;
      }

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (source !== "bank_statement" || !isPdf) {
        throw new Error("Use a CSV file, or a PDF for bank statements.");
      }

      const formData = new FormData();
      formData.set("statement", file);
      const response = await fetch("/api/imports/bank-statement", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({})) as {
        drafts?: ImportedTransactionDraft[];
        warnings?: string[];
        error?: string;
      };
      if (!response.ok || !body.drafts?.length) {
        if (response.status === 429) throw new Error("Statement extraction is busy. Wait a moment and try again.");
        if (response.status === 503) throw new Error("Statement extraction is not configured right now.");
        throw new Error(body.error || `Could not read this statement (${response.status}).`);
      }
      await onImported({ drafts: body.drafts, failures: [], warnings: body.warnings || [], method: "openai_pdf" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not import this file.");
    } finally {
      setImporting(false);
    }
  };

  if (source === "whatsapp") {
    return (
      <section className="capture-input-card" aria-labelledby="whatsapp-input-title">
        <p className="section-kicker">Telegram order · Step 1 of 3</p>
        <h2 id="whatsapp-input-title">Paste an order message</h2>
        <p className="capture-help">Paste an order from Telegram to prepare the record Niaga would create. This web demo does not connect to your Telegram account.</p>
        <div className="message-preview-icon"><MessageCircle aria-hidden="true" size={24} /></div>
        <TextareaField label="Order message" onChange={(event) => setMessage(event.target.value)} rows={6} value={message} />
        <div className="capture-actions">
          <button className="button button-secondary" onClick={onBack} type="button">Back</button>
          <button className="button button-primary" disabled={message.trim().length < 10} onClick={onContinue} type="button">Prepare demo extraction</button>
        </div>
      </section>
    );
  }

  const copy = sourceCopy[source];
  const Icon = copy.icon;
  return (
    <section className="capture-input-card" aria-labelledby="file-input-title">
      <p className="section-kicker">{copy.eyebrow} · Step 1 of 3</p>
      <h2 id="file-input-title">{copy.title}</h2>
      <p className="capture-help">{copy.help}</p>
      {source === "csv" ? (
        <div className="csv-template-help">
          <div>
            <strong>Not sure how to format your file?</strong>
            <span>Start with a ready-to-fill template that matches this importer.</span>
          </div>
          <a className="button button-secondary" download href="/samples/niaga-transaction-import-sample.csv">
            <Download aria-hidden="true" size={18} />
            Download sample CSV
          </a>
        </div>
      ) : null}
      <button className="upload-dropzone" onClick={() => fileRef.current?.click()} type="button">
        <span className="upload-icon"><Icon aria-hidden="true" size={26} /></span>
        <strong>{file?.name || "Select a file"}</strong>
        <small>{file ? "Ready to import" : source === "csv" ? "CSV · maximum 15 MB" : "PDF or CSV · maximum 15 MB"}</small>
      </button>
      <input accept={copy.accept} className="visually-hidden" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(""); }} ref={fileRef} type="file" />
      {file ? <p className="selected-file"><UploadCloud aria-hidden="true" size={16} />{file.name}</p> : null}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <div className="capture-actions">
        <button className="button button-secondary" disabled={importing} onClick={onBack} type="button">Back</button>
        <button className="button button-primary" disabled={!file || importing} onClick={importFile} type="button">{importing ? "Reading transactions…" : "Import transactions"}</button>
      </div>
    </section>
  );
}
