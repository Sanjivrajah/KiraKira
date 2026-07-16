import { z } from "zod";
import { getConfirmationMissingFields, type DraftActionResult, TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import type { TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";

export const actionBundleStatusSchema = z.enum(["awaiting_clarification", "awaiting_confirmation", "executing", "completed", "cancelled", "partially_completed", "failed"]);
export const actionBundleSchema = z.object({
  id: z.string().uuid(),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  sourceMessageId: z.string().min(1),
  draftIds: z.array(z.string().uuid()).min(2).max(4),
  status: actionBundleStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ActionBundle = z.infer<typeof actionBundleSchema>;

export type BundleConfirmationResult =
  | { outcome: "confirmed"; confirmedDraftIds: string[] }
  | { outcome: "incomplete"; missing: Array<{ draftId: string; fields: string[] }> }
  | { outcome: "stale" }
  | { outcome: "partial_failure"; confirmedDraftIds: string[]; failedDraftId: string };

/**
 * The existing local stores cannot atomically write several confirmed records.
 * Prevalidation prevents normal partial writes; an unexpected persistence error is
 * surfaced explicitly so the caller never claims that the whole bundle was saved.
 */
export class ActionBundleConfirmationService {
  constructor(private readonly drafts: { findById(id: string): Promise<TransactionDraft | null> }, private readonly draftService: TransactionDraftService) {}

  async confirmAll(bundle: ActionBundle, telegramUserId: string, telegramChatId: string): Promise<BundleConfirmationResult> {
    if (bundle.telegramUserId !== telegramUserId || bundle.telegramChatId !== telegramChatId || bundle.status !== "awaiting_confirmation") return { outcome: "stale" };
    const drafts = await Promise.all(bundle.draftIds.map((id) => this.drafts.findById(id)));
    if (drafts.some((draft) => !draft || draft.telegramUserId !== telegramUserId || draft.telegramChatId !== telegramChatId || draft.status !== "pending")) return { outcome: "stale" };
    const pendingDrafts = drafts as TransactionDraft[];
    const missing = pendingDrafts.map((draft) => ({ draftId: draft.id, fields: getConfirmationMissingFields(draft) })).filter((item) => item.fields.length > 0);
    if (missing.length) return { outcome: "incomplete", missing };

    const confirmedDraftIds: string[] = [];
    for (const draft of pendingDrafts) {
      try {
        const result: DraftActionResult = await this.draftService.act({ action: "confirm", draftId: draft.id, telegramUserId });
        if (result.outcome !== "confirmed") return confirmedDraftIds.length ? { outcome: "partial_failure", confirmedDraftIds, failedDraftId: draft.id } : { outcome: "stale" };
        confirmedDraftIds.push(draft.id);
      } catch {
        return { outcome: "partial_failure", confirmedDraftIds, failedDraftId: draft.id };
      }
    }
    return { outcome: "confirmed", confirmedDraftIds };
  }
}
