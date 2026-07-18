import { z } from "zod";
import { transactionDraftSchema } from "@/features/transaction-agent/transaction-record.schema";
import { transactionExtractionSchema } from "@/features/transaction-agent/transaction.schema";
import { CONVERSATION_STATE_EXPIRY_MS } from "@/features/transaction-agent/agent-config";

export const conversationModeSchema = z.enum(["awaiting_clarification", "awaiting_correction", "awaiting_review", "awaiting_replacement"]);
export const conversationRequestedFieldSchema = z.enum(["amount", "type", "purpose", "transactionDate", "paymentMethod", "merchantOrCustomer"]);

/** One not-yet-drafted action from a multi-intent message, waiting behind the active draft. */
export const queuedActionSchema = z.object({
  extraction: transactionExtractionSchema,
  originalInput: z.string().min(1),
  sourceType: transactionDraftSchema.shape.sourceType,
});
export type QueuedAction = z.infer<typeof queuedActionSchema>;
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
  /** Remaining multi-intent actions to draft after the active draft resolves. */
  queuedActions: z.array(queuedActionSchema).optional(),
  /** Count of clarification replies handled, so the agent cannot loop indefinitely. */
  clarificationTurns: z.number().int().nonnegative().optional(),
  /** Recent owner replies (oldest first) so re-extraction can resolve cross-turn references. */
  history: z.array(z.object({ role: z.literal("user"), text: z.string().trim().min(1).max(500) })).max(12).optional(),
  /** 1-based position of the active draft within its multi-intent batch. */
  batchIndex: z.number().int().positive().optional(),
  /** Total actions captured from the originating multi-intent message. */
  batchSize: z.number().int().positive().optional(),
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
