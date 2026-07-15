import {
  extractionRunSchema,
  sourceDocumentSchema,
  type ExtractionRun,
  type FinancialTransaction,
  type SourceDocument,
} from "@/domain";
import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { FRONTEND_STORAGE_KEYS } from "./migration";

function upsert<T extends { id: string }>(items: T[], next: T): T[] {
  return [next, ...items.filter((item) => item.id !== next.id)];
}

export function persistReviewProvenance(
  sourceDocument: SourceDocument,
  extractionRun: ExtractionRun,
  storage: KeyValueStorage = browserStorage,
): void {
  if (extractionRun.sourceDocumentId !== sourceDocument.id) {
    throw new Error("The extraction run does not belong to this evidence document.");
  }
  const parsedSource = sourceDocumentSchema.parse(sourceDocument);
  const parsedRun = extractionRunSchema.parse(extractionRun);
  const sources = storage.get<SourceDocument[]>(FRONTEND_STORAGE_KEYS.sourceDocuments, [])
    .map((item) => sourceDocumentSchema.parse(item));
  const runs = storage.get<ExtractionRun[]>(FRONTEND_STORAGE_KEYS.extractionRuns, [])
    .map((item) => extractionRunSchema.parse(item));
  storage.set(FRONTEND_STORAGE_KEYS.sourceDocuments, upsert(sources, parsedSource));
  storage.set(FRONTEND_STORAGE_KEYS.extractionRuns, upsert(runs, parsedRun));
}

export interface TransactionProvenance {
  sourceDocument: SourceDocument;
  extractionRun?: ExtractionRun;
  relationship: "primary" | "supporting" | "derived";
  evidenceNotes?: string;
}

/** Reconstructs evidence associations from persisted IDs instead of copying sensitive source data into transactions. */
export function loadTransactionProvenance(
  transaction: FinancialTransaction,
  storage: KeyValueStorage = browserStorage,
): TransactionProvenance[] {
  const sources = storage.get<unknown[]>(FRONTEND_STORAGE_KEYS.sourceDocuments, [])
    .map((item) => sourceDocumentSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data);
  const runs = storage.get<unknown[]>(FRONTEND_STORAGE_KEYS.extractionRuns, [])
    .map((item) => extractionRunSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data);

  return transaction.sourceLinks.flatMap((link) => {
    const sourceDocument = sources.find((source) => source.id === link.sourceDocumentId);
    if (!sourceDocument) return [];
    const extractionRun = link.extractionRunId
      ? runs.find((run) => run.id === link.extractionRunId && run.sourceDocumentId === sourceDocument.id)
      : undefined;
    return [{
      sourceDocument,
      ...(extractionRun ? { extractionRun } : {}),
      relationship: link.relationship,
      ...(link.evidenceNotes ? { evidenceNotes: link.evidenceNotes } : {}),
    }];
  });
}
