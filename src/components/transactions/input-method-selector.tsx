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
  flow: "Interactive" | "Demo extraction";
}

const methods: Method[] = [
  { source: "receipt", name: "Receipt photo", description: "Upload or drop an image and review sample extracted details.", icon: Camera, flow: "Interactive" },
  { source: "voice", name: "Voice note", description: "Record a demo note or upload audio to create a transaction.", icon: Mic, flow: "Interactive" },
  { source: "manual", name: "Manual entry", description: "Enter a sale or expense directly with no extraction step.", icon: FilePenLine, flow: "Interactive" },
  { source: "csv", name: "CSV import", description: "Choose a spreadsheet file and preview representative data.", icon: FileSpreadsheet, flow: "Demo extraction" },
  { source: "bank_statement", name: "Bank statement", description: "Upload a statement and simulate matching one bank record.", icon: Landmark, flow: "Demo extraction" },
  { source: "whatsapp", name: "WhatsApp order", description: "Paste an order message and turn it into a sample sale.", icon: MessageCircle, flow: "Demo extraction" },
];

export function InputMethodSelector({ onSelect }: { onSelect: (source: TransactionSourceType) => void }) {
  return (
    <section aria-labelledby="capture-method-title">
      <div className="capture-section-heading">
        <div>
          <p className="section-kicker">Step 1 of 3</p>
          <h2 id="capture-method-title">How would you like to add it?</h2>
        </div>
        <p>Every option is local and simulated for this frontend demo.</p>
      </div>
      <div className="capture-method-grid">
        {methods.map(({ source, name, description, icon: Icon, flow }) => (
          <button className="capture-method-card" key={source} onClick={() => onSelect(source)} type="button">
            <span className="capture-method-icon"><Icon aria-hidden="true" size={23} /></span>
            <span className="capture-method-copy">
              <strong>{name}</strong>
              <small>{description}</small>
            </span>
            <span className={`availability-badge ${flow === "Interactive" ? "interactive" : "demo"}`}>{flow}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
