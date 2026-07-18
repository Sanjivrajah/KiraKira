import type { OrchestrationRun, OrchestrationStep } from "@/features/transaction-agent/orchestration.schema";

export type OrchestrationMetrics = {
  runsByCapability: Record<string, number>;
  completedCount: number;
  failedCount: number;
  averageDurationMs: number | null;
  clarificationFrequency: number | null;
  confirmationRate: number | null;
  duplicatePreventionCount: number;
  providerFailureCount: number;
  validationFailures: Record<string, number>;
};

/** Derives aggregate operational data only; raw input, prompts, and provider payloads never enter this view. */
export function deriveOrchestrationMetrics(runs: readonly OrchestrationRun[], steps: readonly OrchestrationStep[]): OrchestrationMetrics {
  const runsByCapability: Record<string, number> = {};
  const validationFailures: Record<string, number> = {};
  let durationTotal = 0; let durationCount = 0; let providerFailureCount = 0;
  for (const run of runs) {
    runsByCapability[run.routedIntent ?? "unrouted"] = (runsByCapability[run.routedIntent ?? "unrouted"] ?? 0) + 1;
    if (run.failureCode === "invalid_input") validationFailures.invalid_input = (validationFailures.invalid_input ?? 0) + 1;
  }
  for (const step of steps) {
    if (step.durationMs !== undefined) { durationTotal += step.durationMs; durationCount += 1; }
    if (step.errorCode === "provider_unavailable") providerFailureCount += 1;
    if (step.errorCode === "invalid_input") validationFailures.invalid_input = (validationFailures.invalid_input ?? 0) + 1;
  }
  const clarificationRuns = runs.filter((run) => run.status === "awaiting_clarification").length;
  const confirmationRuns = runs.filter((run) => run.status === "awaiting_confirmation").length;
  return {
    runsByCapability, completedCount: runs.filter((run) => run.status === "completed").length, failedCount: runs.filter((run) => run.status === "failed").length,
    averageDurationMs: durationCount ? Math.round(durationTotal / durationCount) : null,
    clarificationFrequency: runs.length ? clarificationRuns / runs.length : null,
    confirmationRate: confirmationRuns ? runs.filter((run) => run.status === "completed").length / confirmationRuns : null,
    duplicatePreventionCount: runs.filter((run) => run.outcome === "duplicate").length, providerFailureCount, validationFailures,
  };
}

export function formatSafeTrace(runs: readonly OrchestrationRun[], steps: readonly OrchestrationStep[]): string {
  if (!runs.length) return "No orchestration runs are available for this chat.";
  return runs.slice(0, 10).map((run) => {
    const runSteps = steps.filter((step) => step.runId === run.id);
    const timeline = runSteps.map((step) => `${step.stepKey}: ${step.status}${step.durationMs === undefined ? "" : ` (${step.durationMs}ms)`}${step.errorCode ? ` [${step.errorCode}]` : ""}`).join(" → ") || "No steps recorded";
    return `${run.startedAt} · ${run.routedIntent ?? "unrouted"} · ${run.status}${run.failureCode ? ` [${run.failureCode}]` : ""}\n${timeline}`;
  }).join("\n\n");
}
