import { describe, expect, it } from "vitest";
import { deriveOrchestrationMetrics, formatSafeTrace } from "./agent-observability";
import type { OrchestrationRun, OrchestrationStep } from "./orchestration.schema";

const run = (overrides: Partial<OrchestrationRun> = {}): OrchestrationRun => ({ id: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), telegramUserId: "owner", telegramChatId: "chat", sourceUpdateId: "1", sourceMessageId: "1", inputKind: "text", locale: "en", inputSummary: { characterCount: 12, hasMedia: false, hasAction: false }, status: "completed", routedIntent: "financial_insight", outcome: "processed", startedAt: "2026-07-17T00:00:00.000Z", completedAt: "2026-07-17T00:00:01.000Z", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:01.000Z", ...overrides });

describe("agent observability", () => {
  it("derives safe operational metrics and redacted traces", () => {
    const first = run(); const failed = run({ status: "failed", outcome: "failed", failureCode: "provider_unavailable" });
    const steps: OrchestrationStep[] = [{ id: crypto.randomUUID(), runId: first.id, sequence: 1, stepKey: "financial_insight", intent: "financial_insight", status: "completed", durationMs: 120, startedAt: first.startedAt, completedAt: first.completedAt }, { id: crypto.randomUUID(), runId: failed.id, sequence: 1, stepKey: "financial_insight", intent: "financial_insight", status: "failed", errorCode: "provider_unavailable", durationMs: 80, startedAt: failed.startedAt, completedAt: failed.completedAt }];
    expect(deriveOrchestrationMetrics([first, failed], steps)).toMatchObject({ completedCount: 1, failedCount: 1, averageDurationMs: 100, providerFailureCount: 1, runsByCapability: { financial_insight: 2 } });
    const trace = formatSafeTrace([first], steps);
    expect(trace).toContain("financial_insight: completed (120ms)");
    expect(trace).not.toContain("characterCount");
  });
});
