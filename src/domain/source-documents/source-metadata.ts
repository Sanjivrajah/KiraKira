import type { ISODate, ISODateTime } from "../common";

export interface FileHash {
  algorithm: "sha256";
  value: string;
}

export interface DuplicateDetectionFields {
  contentHash?: FileHash;
  externalSourceId?: string;
  sourceAccountReference?: string;
}

export interface ManualSourceMetadata {
  entryChannel?: "web" | "mobile" | "import";
}

export interface ReceiptSourceMetadata {
  imageWidth?: number;
  imageHeight?: number;
  pageCount?: number;
  captureDevice?: string;
}

export interface VoiceSourceMetadata {
  durationMilliseconds?: number;
  languageCode?: string;
  audioCodec?: string;
}

export interface WhatsAppSourceMetadata {
  chatReference?: string;
  senderReference?: string;
  messageTimestamp?: ISODateTime;
}

export interface CsvSourceMetadata {
  delimiter?: string;
  encoding?: string;
  rowCount?: number;
}

export interface BankStatementSourceMetadata {
  bankName?: string;
  accountLastFour?: string;
  statementPeriodStart?: ISODate;
  statementPeriodEnd?: ISODate;
}

export interface ExternalSystemSourceMetadata {
  systemName: string;
  recordType?: string;
  sourceUrl?: string;
}
