import { join } from "node:path";
import { z } from "zod";
import { JsonArrayStore, withLocalStorageLock } from "@/lib/storage/json-store";
import { normalizeSupabaseTimestamp } from "@/lib/supabase/timestamp";
import { orchestrationRunSchema, orchestrationStepSchema, type OrchestrationRun, type OrchestrationStep } from "@/features/transaction-agent/orchestration.schema";

const orchestrationStoreSchema = z.object({ runs: z.array(orchestrationRunSchema), steps: z.array(orchestrationStepSchema) });

export interface OrchestrationRepository {
  ensure(): Promise<void>;
  findRunByIdempotencyKey(idempotencyKey: string): Promise<OrchestrationRun | null>;
  listRunsByOwner(telegramUserId: string, telegramChatId: string, limit: number): Promise<OrchestrationRun[]>;
  createRun(run: OrchestrationRun): Promise<OrchestrationRun>;
  updateRun(run: OrchestrationRun): Promise<OrchestrationRun>;
  listSteps(runId: string): Promise<OrchestrationStep[]>;
  createStep(step: OrchestrationStep): Promise<OrchestrationStep>;
  updateStep(step: OrchestrationStep): Promise<OrchestrationStep>;
}

/** One local file keeps run and step writes atomic for the development bot. */
export class LocalOrchestrationRepository implements OrchestrationRepository {
  private readonly store: JsonArrayStore<unknown>;
  constructor(directory: string) { this.store = new JsonArrayStore(join(directory, "agent-orchestration.json")); }
  async ensure() { await this.read(); }
  async findRunByIdempotencyKey(idempotencyKey: string) { return (await this.read()).runs.find((run) => run.idempotencyKey === idempotencyKey) ?? null; }
  async listRunsByOwner(telegramUserId: string, telegramChatId: string, limit: number) { return (await this.read()).runs.filter((run) => run.telegramUserId === telegramUserId && run.telegramChatId === telegramChatId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, Math.max(0, limit)); }
  async createRun(run: OrchestrationRun) {
    const parsed = orchestrationRunSchema.parse(run);
    return this.mutate((state) => { if (state.runs.some((item) => item.idempotencyKey === parsed.idempotencyKey)) throw new Error("Orchestration update already exists."); state.runs.push(parsed); return parsed; });
  }
  async updateRun(run: OrchestrationRun) {
    const parsed = orchestrationRunSchema.parse(run);
    return this.mutate((state) => { const index = state.runs.findIndex((item) => item.id === parsed.id); if (index < 0) throw new Error("Orchestration run no longer exists."); state.runs[index] = parsed; return parsed; });
  }
  async listSteps(runId: string) { return (await this.read()).steps.filter((step) => step.runId === runId).sort((left, right) => left.sequence - right.sequence); }
  async createStep(step: OrchestrationStep) {
    const parsed = orchestrationStepSchema.parse(step);
    return this.mutate((state) => { if (state.steps.some((item) => item.id === parsed.id)) throw new Error("Orchestration step already exists."); state.steps.push(parsed); return parsed; });
  }
  async updateStep(step: OrchestrationStep) {
    const parsed = orchestrationStepSchema.parse(step);
    return this.mutate((state) => { const index = state.steps.findIndex((item) => item.id === parsed.id); if (index < 0) throw new Error("Orchestration step no longer exists."); state.steps[index] = parsed; return parsed; });
  }
  private async mutate<T>(operation: (state: z.infer<typeof orchestrationStoreSchema>) => T): Promise<T> {
    return withLocalStorageLock(async () => { const state = await this.read(); const result = operation(state); await this.store.write([state]); return result; });
  }
  private async read() {
    const records = await this.store.read();
    if (records.length === 0) return { runs: [], steps: [] };
    return orchestrationStoreSchema.parse(records[0]);
  }
}

/**
 * The generated Database type intentionally lags the migration in this branch,
 * matching the existing Telegram Supabase adapter convention. Regenerate it
 * after applying the migration before replacing this narrow worker boundary.
 */
export class SupabaseOrchestrationRepository implements OrchestrationRepository {
  constructor(private readonly client: any, private readonly accountIdFor: (userId: string, chatId: string) => Promise<string>) {} // eslint-disable-line @typescript-eslint/no-explicit-any
  async ensure() {}
  async findRunByIdempotencyKey(idempotencyKey: string) { const { data, error } = await this.client.from("agent_orchestration_runs").select("*").eq("idempotency_key", idempotencyKey).maybeSingle(); if (error) throw new Error("Unable to load the orchestration run.", { cause: error }); return data ? this.toRun(data) : null; }
  async listRunsByOwner(telegramUserId: string, telegramChatId: string, limit: number) { const { data, error } = await this.client.from("agent_orchestration_runs").select("*").eq("telegram_user_id", Number(telegramUserId)).eq("telegram_chat_id", Number(telegramChatId)).order("started_at", { ascending: false }).limit(Math.max(0, limit)); if (error) throw new Error("Unable to load orchestration traces.", { cause: error }); return (data ?? []).map((row: unknown) => this.toRun(row)); }
  async createRun(run: OrchestrationRun) { const accountId = await this.accountIdFor(run.telegramUserId, run.telegramChatId); const { data, error } = await this.client.from("agent_orchestration_runs").insert({ id: run.id, telegram_account_id: accountId, telegram_user_id: Number(run.telegramUserId), telegram_chat_id: Number(run.telegramChatId), source_update_id: run.sourceUpdateId, source_message_id: run.sourceMessageId, idempotency_key: run.idempotencyKey, input_kind: run.inputKind, locale: run.locale, input_summary: run.inputSummary, status: run.status, routed_intent: run.routedIntent ?? null, outcome: run.outcome ?? null, failure_code: run.failureCode ?? null, started_at: run.startedAt, completed_at: run.completedAt ?? null }).select("*").single(); if (error) throw new Error("Unable to create the orchestration run.", { cause: error }); return this.toRun(data); }
  async updateRun(run: OrchestrationRun) { const { data, error } = await this.client.from("agent_orchestration_runs").update({ status: run.status, routed_intent: run.routedIntent ?? null, outcome: run.outcome ?? null, failure_code: run.failureCode ?? null, completed_at: run.completedAt ?? null }).eq("id", run.id).select("*").single(); if (error) throw new Error("Unable to update the orchestration run.", { cause: error }); return this.toRun(data); }
  async listSteps(runId: string) { const { data, error } = await this.client.from("agent_orchestration_steps").select("*").eq("run_id", runId).order("sequence"); if (error) throw new Error("Unable to load orchestration steps.", { cause: error }); return (data ?? []).map((row: unknown) => this.toStep(row)); }
  async createStep(step: OrchestrationStep) { const { data, error } = await this.client.from("agent_orchestration_steps").insert({ id: step.id, run_id: step.runId, sequence: step.sequence, step_key: step.stepKey, intent: step.intent, status: step.status, provider: step.provider ?? null, error_code: step.errorCode ?? null, started_at: step.startedAt, completed_at: step.completedAt ?? null, duration_ms: step.durationMs ?? null }).select("*").single(); if (error) throw new Error("Unable to create the orchestration step.", { cause: error }); return this.toStep(data); }
  async updateStep(step: OrchestrationStep) { const { data, error } = await this.client.from("agent_orchestration_steps").update({ status: step.status, provider: step.provider ?? null, error_code: step.errorCode ?? null, completed_at: step.completedAt ?? null, duration_ms: step.durationMs ?? null }).eq("id", step.id).select("*").single(); if (error) throw new Error("Unable to update the orchestration step.", { cause: error }); return this.toStep(data); }
  private toRun(row: any): OrchestrationRun { return orchestrationRunSchema.parse({ id: row.id, idempotencyKey: row.idempotency_key, telegramUserId: String(row.telegram_user_id), telegramChatId: String(row.telegram_chat_id), sourceUpdateId: String(row.source_update_id), sourceMessageId: String(row.source_message_id), inputKind: row.input_kind, locale: row.locale, inputSummary: row.input_summary, status: row.status, ...(row.routed_intent ? { routedIntent: row.routed_intent } : {}), ...(row.outcome ? { outcome: row.outcome } : {}), ...(row.failure_code ? { failureCode: row.failure_code } : {}), startedAt: normalizeSupabaseTimestamp(row.started_at), ...(row.completed_at ? { completedAt: normalizeSupabaseTimestamp(row.completed_at) } : {}), createdAt: normalizeSupabaseTimestamp(row.created_at), updatedAt: normalizeSupabaseTimestamp(row.updated_at) }); } // eslint-disable-line @typescript-eslint/no-explicit-any
  private toStep(row: any): OrchestrationStep { return orchestrationStepSchema.parse({ id: row.id, runId: row.run_id, sequence: row.sequence, stepKey: row.step_key, intent: row.intent, status: row.status, ...(row.provider ? { provider: row.provider } : {}), ...(row.error_code ? { errorCode: row.error_code } : {}), ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}), startedAt: normalizeSupabaseTimestamp(row.started_at), ...(row.completed_at ? { completedAt: normalizeSupabaseTimestamp(row.completed_at) } : {}) }); } // eslint-disable-line @typescript-eslint/no-explicit-any
}
