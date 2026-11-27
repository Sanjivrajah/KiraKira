import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("openai", () => {
  class APIError extends Error {
    constructor(readonly status?: number) {
      super("provider error");
    }
  }
  class OpenAI {
    static APIError = APIError;
    live = { create: mocks.create };
  }
  return { default: OpenAI };
});

import { createLiveVoiceSession } from "./live-session";

describe("createLiveVoiceSession", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.create.mockResolvedValue({ session: { id: "live_1" }, transport: { sdp: "answer" } });
  });

  it("gives the delegated tool-calling model the same instructions as the voice model", async () => {
    await createLiveVoiceSession({ sdp: "offer", instructions: "Stage first, then wait for yes. Today is 2026-11-27." });

    const { session } = mocks.create.mock.calls[0][0];
    expect(session.instructions).toBe("Stage first, then wait for yes. Today is 2026-11-27.");
    expect(session.delegation.responses.instructions).toBe(session.instructions);
  });

  it("returns the session id and SDP answer", async () => {
    await expect(createLiveVoiceSession({ sdp: "offer", instructions: "x" }))
      .resolves.toEqual({ sessionId: "live_1", sdp: "answer" });
  });
});
