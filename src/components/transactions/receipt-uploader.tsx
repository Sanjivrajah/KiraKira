"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FileImage, Images, UploadCloud, X } from "lucide-react";
import type { ReceiptExtraction } from "@/lib/openai/receipt-schema";

const MAX_RECEIPTS = 10;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const EXTRACTION_TIMEOUT_MS = 45_000;

interface QueuedReceipt {
  file: File;
  preview: string;
  id: string;
}

export interface ReceiptBatchResult {
  extractions: ReceiptExtraction[];
  failures: Array<{ fileName: string; message: string }>;
}

export function ReceiptUploader({ onExtracted, onBack }: {
  onExtracted: (result: ReceiptBatchResult) => void;
  onBack: () => void;
}) {
  const [receipts, setReceipts] = useState<QueuedReceipt[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const receiptsRef = useRef<QueuedReceipt[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const extractingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    receiptsRef.current = receipts;
  }, [receipts]);

  useEffect(() => () => {
    abortRef.current?.abort();
    receiptsRef.current.forEach((receipt) => URL.revokeObjectURL(receipt.preview));
  }, []);

  const chooseFiles = (selected: FileList | File[]) => {
    const files = Array.from(selected);
    const supported = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    const candidates = supported.filter((file) => file.size > 0 && file.size <= MAX_RECEIPT_BYTES);
    setReceipts((current) => {
      const existing = new Set(current.map((receipt) => receipt.id));
      const available = MAX_RECEIPTS - current.length;
      const additions = candidates
        .map((file) => ({ file, id: `${file.name}-${file.size}-${file.lastModified}` }))
        .filter(({ id }) => !existing.has(id))
        .slice(0, available)
        .map(({ file, id }) => ({ file, id, preview: URL.createObjectURL(file) }));
      return [...current, ...additions];
    });
    if (files.length > MAX_RECEIPTS) setError(`Choose up to ${MAX_RECEIPTS} receipts at a time.`);
    else if (supported.length === 0) setError("Use JPG, PNG, or WEBP receipt images.");
    else if (candidates.length !== supported.length) setError("Each receipt must be between 1 byte and 10 MB.");
    else setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeReceipt = (id: string) => {
    setReceipts((current) => {
      const removed = current.find((receipt) => receipt.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return current.filter((receipt) => receipt.id !== id);
    });
  };

  const extractReceipts = async () => {
    if (receipts.length === 0 || extractingRef.current) return;
    extractingRef.current = true;
    setError("");
    const extractions: ReceiptExtraction[] = [];
    const failures: ReceiptBatchResult["failures"] = [];

    for (const [index, receipt] of receipts.entries()) {
      setProgress({ current: index + 1, total: receipts.length });
      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);
        const formData = new FormData();
        formData.set("image", receipt.file);
        try {
          const response = await fetch("/api/vision/receipts", { method: "POST", body: formData, signal: controller.signal });
          const body = await response.json().catch(() => ({})) as { extraction?: ReceiptExtraction; error?: string };
          if (!response.ok || !body.extraction) {
            if (response.status === 429) throw new Error("Receipt extraction is busy. Wait a moment and try again.");
            if (response.status === 503) throw new Error("Receipt extraction is not configured right now.");
            throw new Error(body.error || `Could not read this receipt (${response.status}).`);
          }
          extractions.push(body.extraction);
        } finally {
          window.clearTimeout(timeout);
        }
      } catch (cause) {
        failures.push({
          fileName: receipt.file.name,
          message: cause instanceof DOMException && cause.name === "AbortError"
            ? "Receipt extraction timed out. Try again on a stronger connection."
            : cause instanceof Error ? cause.message : "Could not read this receipt.",
        });
      }
    }

    abortRef.current = null;
    extractingRef.current = false;
    setProgress(null);
    if (extractions.length === 0) {
      setError(failures[0]?.message || "We could not read these receipts.");
      return;
    }
    onExtracted({ extractions, failures });
  };

  return (
    <section className="capture-input-card receipt-batch-card" aria-labelledby="receipt-upload-title">
      <p className="section-kicker">Receipt photos · Step 1 of 3</p>
      <h2 id="receipt-upload-title">Add up to 10 receipts</h2>
      <p className="capture-help">We process receipts one at a time to control cost and make failures recoverable. You will review every proposed transaction before saving.</p>

      <button
        className="upload-dropzone receipt-batch-dropzone"
        disabled={progress !== null || receipts.length >= MAX_RECEIPTS}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); chooseFiles(event.dataTransfer.files); }}
        type="button"
      >
        <span className="upload-icon"><UploadCloud aria-hidden="true" size={26} /></span>
        <strong>{receipts.length ? "Add more receipts" : "Select or drop receipt images"}</strong>
        <small>JPG, PNG, or WEBP · maximum 10 MB each</small>
      </button>
      <input accept="image/jpeg,image/png,image/webp" className="visually-hidden" multiple onChange={(event) => event.target.files && chooseFiles(event.target.files)} ref={inputRef} type="file" />

      {receipts.length ? (
        <div className="receipt-queue" aria-label={`${receipts.length} receipts selected`}>
          <div className="receipt-queue-heading"><span><Images aria-hidden="true" size={17} />Ready to extract</span><strong>{receipts.length}/{MAX_RECEIPTS}</strong></div>
          <ul>
            {receipts.map((receipt, index) => (
              <li key={receipt.id}>
                <Image alt="" height={48} src={receipt.preview} unoptimized width={48} />
                <span><strong>Receipt {index + 1}</strong><small>{receipt.file.name}</small></span>
                <button aria-label={`Remove ${receipt.file.name}`} disabled={progress !== null} onClick={() => removeReceipt(receipt.id)} type="button"><X aria-hidden="true" size={17} /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {progress ? <p className="batch-progress" role="status"><FileImage aria-hidden="true" size={17} />Reading receipt {progress.current} of {progress.total}…</p> : null}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <div className="capture-actions">
        <button className="button button-secondary" disabled={progress !== null} onClick={onBack} type="button">Back</button>
        <button className="button button-primary" disabled={receipts.length === 0 || progress !== null} onClick={extractReceipts} type="button">{progress ? `Reading ${progress.current}/${progress.total}…` : `Extract ${receipts.length || ""} receipt${receipts.length === 1 ? "" : "s"}`}</button>
      </div>
    </section>
  );
}
