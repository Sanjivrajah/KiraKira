import { describe, expect, it } from "vitest";
import { appendTranscriptTurn, MAX_TRANSCRIPT_TURNS, type TranscriptTurn } from "./voice-transcript";

describe("appendTranscriptTurn", () => {
  it("adds the first turn with id 1", () => {
    const result = appendTranscriptTurn([], { message: "Hello there", source: "ai" });
    expect(result).toEqual([{ id: 1, role: "assistant", text: "Hello there" }]);
  });

  it("maps source 'user' to the user role and 'ai' to assistant", () => {
    const result = appendTranscriptTurn([], { message: "I spent RM45", source: "user" });
    expect(result[0].role).toBe("user");
  });

  it("ignores blank or whitespace-only messages", () => {
    const seed: TranscriptTurn[] = [{ id: 1, role: "user", text: "Hi" }];
    expect(appendTranscriptTurn(seed, { message: "   ", source: "ai" })).toBe(seed);
    expect(appendTranscriptTurn([], { message: "", source: "ai" })).toEqual([]);
  });

  it("coalesces consecutive same-role turns, preferring the longer transcript", () => {
    let turns = appendTranscriptTurn([], { message: "How much", source: "ai" });
    turns = appendTranscriptTurn(turns, { message: "How much profit this month", source: "ai" });
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("How much profit this month");
    expect(turns[0].id).toBe(1);
  });

  it("joins same-role text when the new message is not an extension", () => {
    let turns = appendTranscriptTurn([], { message: "Longer first sentence.", source: "user" });
    turns = appendTranscriptTurn(turns, { message: "Next.", source: "user" });
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("Longer first sentence. Next.");
  });

  it("starts a new turn when the speaker changes and increments the id", () => {
    let turns = appendTranscriptTurn([], { message: "Hi", source: "user" });
    turns = appendTranscriptTurn(turns, { message: "Hello, how can I help?", source: "ai" });
    expect(turns).toHaveLength(2);
    expect(turns[1]).toEqual({ id: 2, role: "assistant", text: "Hello, how can I help?" });
  });

  it("caps the transcript at MAX_TRANSCRIPT_TURNS, dropping the oldest", () => {
    let turns: TranscriptTurn[] = [];
    for (let i = 0; i < MAX_TRANSCRIPT_TURNS + 5; i += 1) {
      const source = i % 2 === 0 ? "user" : "ai";
      turns = appendTranscriptTurn(turns, { message: `line ${i}`, source });
    }
    expect(turns).toHaveLength(MAX_TRANSCRIPT_TURNS);
    expect(turns[turns.length - 1].text).toBe(`line ${MAX_TRANSCRIPT_TURNS + 4}`);
    // Oldest turns were trimmed off the front.
    expect(turns[0].text).not.toBe("line 0");
  });
});
