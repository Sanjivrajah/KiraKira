import { z } from "zod";
import { transactionDraftSchema } from "@/features/transaction-agent/transaction-record.schema";
import { CONVERSATION_STATE_EXPIRY_MS } from "@/features/transaction-agent/agent-config";

export const conversationModeSchema = z.enum(["awaiting_clarification", "awaiting_correction", "awaiting_review", "awaiting_replacement"]);
export const conversationRequestedFieldSchema = z.enum(["amount", "type", "purpose", "transactionDate", "paymentMethod", "merchantOrCustomer"]);

export const conversationStateSchema = z.object({
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  draftId: transactionDraftSchema.shape.id,
  mode: conversationModeSchema,
  requestedField: conversationRequestedFieldSchema.optional(),
  replacementInput: z.object({
    text: z.string().min(1),
    sourceType: transactionDraftSchema.shape.sourceType,
    transcript: z.string().min(1).optional(),
    telegramFileId: z.string().min(1).optional(),
  }).optional(),
  inlineMessageId: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConversationState = z.infer<typeof conversationStateSchema>;
export type ConversationRequestedField = z.infer<typeof conversationRequestedFieldSchema>;

export { CONVERSATION_STATE_EXPIRY_MS } from "@/features/transaction-agent/agent-config";

export function isConversationStateExpired(state: ConversationState, now = new Date()): boolean {
  return now.getTime() - new Date(state.updatedAt).getTime() >= CONVERSATION_STATE_EXPIRY_MS;
}
