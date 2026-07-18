import { agentInputEnvelopeSchema, type AgentInputEnvelope, type OrchestrationErrorCode, type OrchestrationRun, type RoutedIntent } from "@/features/transaction-agent/orchestration.schema";
import type { OrchestrationRepository } from "@/features/transaction-agent/orchestration-repository";

export type OrchestrationExecution<T> = { outcome: "processed"; run: OrchestrationRun; value: T } | { outcome: "duplicate"; run: OrchestrationRun } | { outcome: "failed"; run: OrchestrationRun; errorCode: OrchestrationErrorCode };

export function orchestrationIdempotencyKey(input: AgentInputEnvelope): string {
  return input.actionId ? `telegram:${input.updateId}:callback:${input.actionId}` : `telegram:${input.updateId}:${input.messageId}:${input.inputKind}`;
}

export function safeOrchestrationErrorCode(error: unknown): OrchestrationErrorCode {
  if (error instanceof Error && /openai|elevenlabs|transcrib|extract|provider/i.test(error.message)) return "provider_unavailable";
  if (error instanceof Error && /invalid|unsupported|too large|malformed/i.test(error.message)) return "invalid_input";
  if (error instanceof Error && /save|store|persist|database|supabase|json/i.test(error.message)) return "persistence_failed";
  return "unexpected";
}

const permittedTransitions = {
  received: ["routing", "failed"],
  routing: ["awaiting_clarification", "awaiting_confirmation", "executing", "completed", "cancelled", "failed"],
  awaiting_clarification: ["routing", "cancelled", "failed"],
  awaiting_confirmation: ["executing", "cancelled", "failed"],
  executing: ["completed", "failed"],
  completed: [],
  cancelled: [],
  failed: [],
} as const;

export function assertOrchestrationTransition(from: OrchestrationRun["status"], to: OrchestrationRun["status"]): void {
  if (!permittedTransitions[from].includes(to as never)) throw new Error(`Invalid orchestration transition from ${from} to ${to}.`);
}

/** Transport-neutral coordinator for the existing, owner-confirmed transaction capability. */
export class TransactionOrchestrationService {
  constructor(private readonly repository: OrchestrationRepository, private readonly now: () => Date = () => new Date(), private readonly log: Pick<Console, "info"> = console) {}

  async execute<T>(envelope: AgentInputEnvelope, transactionCapture: () => Promise<T>): Promise<OrchestrationExecution<T>> {
    return this.executeCapability(envelope, "transaction_capture", transactionCapture);
  }

  async executeCapability<T>(envelope: AgentInputEnvelope, intent: RoutedIntent, operation: () => Promise<T>): Promise<OrchestrationExecution<T>> {
    const input = agentInputEnvelopeSchema.parse(envelope);
    const idempotencyKey = orchestrationIdempotencyKey(input);
    const duplicate = await this.repository.findRunByIdempotencyKey(idempotencyKey);
    if (duplicate) return { outcome: "duplicate", run: duplicate };

    const timestamp = this.now().toISOString();
    let run: OrchestrationRun;
    try {
      run = await this.repository.createRun({ id: crypto.randomUUID(), idempotencyKey, telegramUserId: input.telegramUserId, telegramChatId: input.telegramChatId, sourceUpdateId: input.updateId, sourceMessageId: input.messageId, inputKind: input.inputKind, locale: input.locale, inputSummary: { characterCount: input.normalizedText?.length ?? 0, hasMedia: Boolean(input.mediaReference), hasAction: Boolean(input.actionId) }, status: "routing", routedIntent: intent, startedAt: timestamp, createdAt: timestamp, updatedAt: timestamp });
    } catch (error) {
      const concurrentRun = await this.repository.findRunByIdempotencyKey(idempotencyKey);
      if (concurrentRun) return { outcome: "duplicate", run: concurrentRun };
      throw error;
    }
    const startedAt = this.now();
    let step = await this.repository.createStep({ id: crypto.randomUUID(), runId: run.id, sequence: 1, stepKey: intent, intent, status: "started", startedAt: startedAt.toISOString() });
    this.log.info(JSON.stringify({ event: "agent_orchestration_step", runId: run.id, stepKey: step.stepKey, status: step.status }));
    try {
      const value = await operation();
      const completedAt = this.now();
      step = await this.repository.updateStep({ ...step, status: "completed", completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - startedAt.getTime() });
      assertOrchestrationTransition(run.status, "completed");
      run = await this.repository.updateRun({ ...run, status: "completed", outcome: "processed", completedAt: completedAt.toISOString(), updatedAt: completedAt.toISOString() });
      this.log.info(JSON.stringify({ event: "agent_orchestration_step", runId: run.id, stepKey: step.stepKey, status: step.status, durationMs: step.durationMs }));
      return { outcome: "processed", run, value };
    } catch (error) {
      const completedAt = this.now(); const errorCode = safeOrchestrationErrorCode(error);
      step = await this.repository.updateStep({ ...step, status: "failed", errorCode, completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - startedAt.getTime() });
      assertOrchestrationTransition(run.status, "failed");
      run = await this.repository.updateRun({ ...run, status: "failed", outcome: "failed", failureCode: errorCode, completedAt: completedAt.toISOString(), updatedAt: completedAt.toISOString() });
      this.log.info(JSON.stringify({ event: "agent_orchestration_step", runId: run.id, stepKey: step.stepKey, status: step.status, durationMs: step.durationMs, errorCode }));
      return { outcome: "failed", run, errorCode };
    }
  }
}
