import { describe, expect, it } from "vitest";
import { appendTranscriptDelta, MAX_TRANSCRIPT_TURNS, type TranscriptTurn } from "./voice-transcript";

describe("appendTranscriptDelta", () => {
  it("starts the first turn with id 1", () => {
    expect(appendTranscriptDelta([], "assistant", "Hello")).toEqual([{ id: 1, role: "assistant", text: "Hello" }]);
  });

  it("concatenates streamed deltas from the same speaker without inserting spaces", () => {
    const first = appendTranscriptDelta([], "user", "Hel");
    const second = appendTranscriptDelta(first, "user", "lo");
    const third = appendTranscriptDelta(second, "user", " there");
    expect(third).toEqual([{ id: 1, role: "user", text: "Hello there" }]);
  });

  it("opens a new turn when the speaker changes", () => {
    const turns = appendTranscriptDelta(appendTranscriptDelta([], "user", "I spent RM45"), "assistant", "Got it");
    expect(turns.map((turn) => [turn.id, turn.role])).toEqual([[1, "user"], [2, "assistant"]]);
  });

  it("ignores empty deltas and whitespace that would open a turn", () => {
    const seed: TranscriptTurn[] = [{ id: 1, role: "user", text: "Hi" }];
    expect(appendTranscriptDelta(seed, "user", "")).toBe(seed);
    expect(appendTranscriptDelta(seed, "assistant", "   ")).toBe(seed);
  });

  it("trims leading whitespace when a new turn starts", () => {
    expect(appendTranscriptDelta([], "assistant", "  Okay")[0].text).toBe("Okay");
  });

  it("keeps Malay and emoji text intact", () => {
    expect(appendTranscriptDelta([], "user", "semalam 😀")[0].text).toBe("semalam 😀");
  });

  it("caps the transcript at MAX_TRANSCRIPT_TURNS, keeping the newest turns", () => {
    let turns: TranscriptTurn[] = [];
    for (let index = 0; index < MAX_TRANSCRIPT_TURNS + 1; index += 1) {
      turns = appendTranscriptDelta(turns, index % 2 === 0 ? "user" : "assistant", `turn ${index}`);
    }
    expect(turns).toHaveLength(MAX_TRANSCRIPT_TURNS);
    expect(turns[turns.length - 1].text).toBe(`turn ${MAX_TRANSCRIPT_TURNS}`);
    expect(turns[0].id).toBe(2);
  });
});
