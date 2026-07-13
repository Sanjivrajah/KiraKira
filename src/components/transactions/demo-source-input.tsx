"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Landmark, MessageCircle, UploadCloud } from "lucide-react";
import { TextareaField } from "@/components/forms/textarea-field";

const sourceCopy = {
  csv: {
    eyebrow: "CSV import",
    title: "Choose a transaction file",
    help: "Select a CSV file. This demo will return one representative expense for review.",
    accept: ".csv,text/csv",
    icon: FileSpreadsheet,
  },
  bank_statement: {
    eyebrow: "Bank statement",
    title: "Choose a bank statement",
    help: "Select a PDF or CSV statement. No file leaves your device in this demo.",
    accept: ".pdf,.csv,application/pdf,text/csv",
    icon: Landmark,
  },
} as const;

export function DemoSourceInput({ source, onContinue, onBack }: { source: "csv" | "bank_statement" | "whatsapp"; onContinue: () => void; onBack: () => void }) {
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("Hi Kak Lina, can I order 40 lunch boxes for Friday? Total RM850. I’ll transfer the deposit today.");
  const fileRef = useRef<HTMLInputElement>(null);

  if (source === "whatsapp") {
    return (
      <section className="capture-input-card" aria-labelledby="whatsapp-input-title">
        <p className="section-kicker">WhatsApp order · Step 1 of 3</p>
        <h2 id="whatsapp-input-title">Paste an order message</h2>
        <p className="capture-help">This is only a text preview. The demo does not connect to WhatsApp.</p>
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
      <button className="upload-dropzone" onClick={() => fileRef.current?.click()} type="button">
        <span className="upload-icon"><Icon aria-hidden="true" size={26} /></span>
        <strong>{fileName || "Select a file"}</strong>
        <small>{fileName ? "Ready for a sample extraction" : "Demo preview only"}</small>
      </button>
      <input accept={copy.accept} className="visually-hidden" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} ref={fileRef} type="file" />
      {fileName ? <p className="selected-file"><UploadCloud aria-hidden="true" size={16} />{fileName}</p> : null}
      <div className="capture-actions">
        <button className="button button-secondary" onClick={onBack} type="button">Back</button>
        <button className="button button-primary" disabled={!fileName} onClick={onContinue} type="button">Prepare demo extraction</button>
      </div>
    </section>
  );
}
