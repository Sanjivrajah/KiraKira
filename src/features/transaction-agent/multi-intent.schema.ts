import { z } from "zod";
import { transactionExtractionSchema } from "@/features/transaction-agent/transaction.schema";
import { MAX_AGENT_ACTIONS_PER_MESSAGE } from "@/features/transaction-agent/agent-config";

/** Kept deliberately small so a Telegram message remains reviewable on one screen. */
export const MAX_MULTI_INTENT_ACTIONS = MAX_AGENT_ACTIONS_PER_MESSAGE;

export const supportedCapabilitySchema = z.enum(["transaction_capture", "receivable_capture", "unsupported"]);

const evidenceSummarySchema = z.string().trim().min(1).max(160);

export const multiIntentActionSchema = z.object({
  actionIndex: z.number().int().min(1).max(MAX_MULTI_INTENT_ACTIONS),
  capability: supportedCapabilitySchema,
  // Only transaction_capture is executable in this session. This is null for other
  // capabilities. OpenAI structured outputs require every field present, so this must be
  // nullable rather than optional, and `uncertainty` cannot carry a client-side default.
  transaction: transactionExtractionSchema.nullable(),
  evidenceSummary: evidenceSummarySchema,
  uncertainty: z.enum(["none", "needs_review", "unsupported"]),
  missingFields: z.array(transactionExtractionSchema.shape.missingFields.element).max(7),
});

export const multiIntentExtractionSchema = z.object({
  actions: z.array(multiIntentActionSchema).min(1).max(MAX_MULTI_INTENT_ACTIONS)
    .superRefine((actions, context) => {
      const seen = new Set<number>();
      actions.forEach((action, index) => {
        if (seen.has(action.actionIndex)) context.addIssue({ code: "custom", message: "actionIndex values must be unique.", path: [index, "actionIndex"] });
        seen.add(action.actionIndex);
        if (action.capability === "transaction_capture" && !action.transaction) context.addIssue({ code: "custom", message: "A transaction action requires a transaction proposal.", path: [index, "transaction"] });
        if (action.capability !== "transaction_capture" && action.transaction) context.addIssue({ code: "custom", message: "Only transaction actions may contain a transaction proposal.", path: [index, "transaction"] });
      });
    }),
  globalAmbiguityNotes: z.array(z.string().trim().min(1).max(160)).max(3),
});

export type SupportedCapability = z.infer<typeof supportedCapabilitySchema>;
export type MultiIntentAction = z.infer<typeof multiIntentActionSchema>;
export type MultiIntentExtraction = z.infer<typeof multiIntentExtractionSchema>;
