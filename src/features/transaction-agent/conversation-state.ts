import { z } from "zod";
import { transactionDraftSchema } from "@/features/transaction-agent/transaction-record.schema";
import { CONVERSATION_STATE_EXPIRY_MS } from "@/features/transaction-agent/agent-config";

export const conversationModeSchema = z.enum(["awaiting_clarification", "awaiting_correction", "awaiting_review", "awaiting_replacement"]);
export const conversationRequestedFieldSchema = z.enum(["amount", "type", "purpose", "transactionDate", "paymentMethod", "merchantOrCustomer"]);
export const workflowTypeSchema = z.enum(["transaction_capture"]);
export const workflowStatusSchema = z.enum([
  "collecting_input",
  "routing",
  "awaiting_clarification",
  "awaiting_confirmation",
  "duplicate_warning",
  "executing",
  "completed",
  "cancelled",
  "expired",
  "failed",
]);

const workflowStatusForMode = {
  awaiting_clarification: "awaiting_clarification",
  awaiting_correction: "awaiting_clarification",
  awaiting_review: "awaiting_confirmation",
  awaiting_replacement: "routing",
} as const;

export const conversationStateSchema = z.object({
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  draftId: transactionDraftSchema.shape.id,
  workflowId: z.string().uuid().default(() => crypto.randomUUID()),
  workflowType: workflowTypeSchema.default("transaction_capture"),
  workflowVersion: z.literal(1).default(1),
  workflowStatus: workflowStatusSchema.optional(),
  mode: conversationModeSchema,
  requestedField: conversationRequestedFieldSchema.optional(),
  currentActionId: z.string().min(1).max(120).optional(),
  collectedValues: z.record(z.string(), z.unknown()).default({}),
  replacementInput: z.object({
    text: z.string().min(1),
    sourceType: transactionDraftSchema.shape.sourceType,
    transcript: z.string().min(1).optional(),
    telegramFileId: z.string().min(1).optional(),
  }).optional(),
  inlineMessageId: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).transform((state) => ({
  ...state,
  workflowStatus: state.workflowStatus ?? workflowStatusForMode[state.mode],
  expiresAt: state.expiresAt ?? new Date(new Date(state.updatedAt).getTime() + CONVERSATION_STATE_EXPIRY_MS).toISOString(),
}));

export type ConversationState = z.infer<typeof conversationStateSchema>;
export type ConversationRequestedField = z.infer<typeof conversationRequestedFieldSchema>;

export { CONVERSATION_STATE_EXPIRY_MS } from "@/features/transaction-agent/agent-config";

export function isConversationStateExpired(state: ConversationState, now = new Date()): boolean {
  return state.workflowStatus === "expired" || now.getTime() >= new Date(state.expiresAt).getTime();
}
