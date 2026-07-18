import { z } from "zod";

export const agentInputKindSchema = z.enum(["text", "voice", "receipt_image", "callback"]);
export const orchestrationRunStatusSchema = z.enum([
  "received",
  "routing",
  "awaiting_clarification",
  "awaiting_confirmation",
  "executing",
  "completed",
  "cancelled",
  "failed",
]);
export const orchestrationStepStatusSchema = z.enum(["started", "completed", "failed", "skipped"]);
export const routedIntentSchema = z.enum(["transaction_capture", "financial_insight"]);
export const proposedActionSchema = z.enum(["create_transaction", "update_transaction_draft", "confirm_transaction", "cancel_transaction", "undo_transaction"]);
export const orchestrationOutcomeSchema = z.enum(["processed", "duplicate", "failed"]);
export const orchestrationErrorCodeSchema = z.enum(["provider_unavailable", "invalid_input", "persistence_failed", "unexpected"]);

/** Transport-normalized metadata. Raw text and provider payloads are never persisted. */
export const agentInputEnvelopeSchema = z.object({
  updateId: z.string().min(1),
  messageId: z.string().min(1),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  inputKind: agentInputKindSchema,
  locale: z.enum(["en", "ms"]),
  normalizedText: z.string().min(1).optional(),
  mediaReference: z.string().min(1).optional(),
  actionId: z.string().min(1).optional(),
  receivedAt: z.string().datetime(),
});

export const orchestrationRunSchema = z.object({
  id: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  sourceUpdateId: z.string().min(1),
  sourceMessageId: z.string().min(1),
  inputKind: agentInputKindSchema,
  locale: z.enum(["en", "ms"]),
  inputSummary: z.object({ characterCount: z.number().int().nonnegative(), hasMedia: z.boolean(), hasAction: z.boolean() }),
  status: orchestrationRunStatusSchema,
  routedIntent: routedIntentSchema.optional(),
  outcome: orchestrationOutcomeSchema.optional(),
  failureCode: orchestrationErrorCodeSchema.optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const orchestrationStepSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  sequence: z.number().int().positive(),
  stepKey: z.string().min(1).max(80),
  intent: routedIntentSchema,
  status: orchestrationStepStatusSchema,
  provider: z.enum(["openai", "elevenlabs"]).optional(),
  errorCode: orchestrationErrorCodeSchema.optional(),
  durationMs: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type AgentInputEnvelope = z.infer<typeof agentInputEnvelopeSchema>;
export type OrchestrationRun = z.infer<typeof orchestrationRunSchema>;
export type OrchestrationStep = z.infer<typeof orchestrationStepSchema>;
export type OrchestrationErrorCode = z.infer<typeof orchestrationErrorCodeSchema>;
export type RoutedIntent = z.infer<typeof routedIntentSchema>;
