import { z } from "zod";
import { transactionDraftSchema } from "@/features/transaction-agent/transaction-record.schema";

export const conversationModeSchema = z.enum(["awaiting_clarification", "awaiting_correction"]);
export const conversationRequestedFieldSchema = z.enum(["amount", "type", "purpose", "transactionDate", "paymentMethod", "merchantOrCustomer"]);

export const conversationStateSchema = z.object({
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  draftId: transactionDraftSchema.shape.id,
  mode: conversationModeSchema,
  requestedField: conversationRequestedFieldSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConversationState = z.infer<typeof conversationStateSchema>;
export type ConversationRequestedField = z.infer<typeof conversationRequestedFieldSchema>;

export const CONVERSATION_STATE_EXPIRY_MS = 30 * 60 * 1000;

export function isConversationStateExpired(state: ConversationState, now = new Date()): boolean {
  return now.getTime() - new Date(state.updatedAt).getTime() >= CONVERSATION_STATE_EXPIRY_MS;
}
