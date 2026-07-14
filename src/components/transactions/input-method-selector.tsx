import {
  Camera,
  FilePenLine,
  FileSpreadsheet,
  Landmark,
  MessageCircle,
  Mic,
  type LucideIcon,
} from "lucide-react";
import type { TransactionSourceType } from "@/types";

interface Method {
  source: TransactionSourceType;
  name: string;
  description: string;
  icon: LucideIcon;
  flow: "Available" | "Demo";
}

const methods: Method[] = [
  { source: "receipt", name: "Receipt photos", description: "Upload up to 10 images, extract them with AI, and review each draft.", icon: Camera, flow: "Available" },
  { source: "voice", name: "Voice note", description: "Record or upload audio, transcribe it with Scribe, and review the proposed transaction.", icon: Mic, flow: "Available" },
  { source: "manual", name: "Manual entry", description: "Enter a sale or expense directly with no extraction step.", icon: FilePenLine, flow: "Available" },
  { source: "csv", name: "CSV import", description: "Parse up to 100 transaction rows locally and review each one.", icon: FileSpreadsheet, flow: "Available" },
  { source: "bank_statement", name: "Bank statement", description: "Import a bank CSV locally or extract transactions from a PDF with AI.", icon: Landmark, flow: "Available" },
  { source: "whatsapp", name: "WhatsApp order", description: "Preview how a pasted order message could become a sale.", icon: MessageCircle, flow: "Demo" },
];

export function InputMethodSelector({ onSelect }: { onSelect: (source: TransactionSourceType) => void }) {
  return (
    <section aria-labelledby="capture-method-title">
      <div className="capture-section-heading">
        <div>
          <p className="section-kicker">Step 1 of 3</p>
          <h2 id="capture-method-title">How would you like to add it?</h2>
        </div>
        <p>CSV stays on this device. Receipt images, voice notes, and bank PDFs use secure AI extraction.</p>
      </div>
      <div className="capture-method-grid">
        {methods.map(({ source, name, description, icon: Icon, flow }) => (
          <button className="capture-method-card" key={source} onClick={() => onSelect(source)} type="button">
            <span className="capture-method-icon"><Icon aria-hidden="true" size={23} /></span>
            <span className="capture-method-copy">
              <strong>{name}</strong>
              <small>{description}</small>
            </span>
            <span className={`availability-badge ${flow === "Available" ? "interactive" : "demo"}`}>{flow}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
