import { describe, expect, it } from "vitest";
import { agentEvaluationFixtures } from "./evaluation-fixtures";

describe("agent evaluation fixture set", () => {
  it("covers the Session 7 synthetic inputs with bounded, safe expected outcomes", () => {
    expect(agentEvaluationFixtures).toHaveLength(14);
    expect(new Set(agentEvaluationFixtures.map((fixture) => fixture.id)).size).toBe(agentEvaluationFixtures.length);
    for (const fixture of agentEvaluationFixtures) {
      expect(fixture.input).toBeTruthy();
      expect(fixture.expected.actionCount).toBeGreaterThanOrEqual(0);
      expect(fixture.expected.actionCount).toBeLessThanOrEqual(3);
      if (fixture.expected.requiredMissingFields) expect(fixture.expected.safeTransition).toBe("awaiting_clarification");
    }
  });
});
