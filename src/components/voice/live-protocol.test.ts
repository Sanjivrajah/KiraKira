import { describe, expect, it, vi } from "vitest";
import { parseLiveServerEvent, runToolCalls, toolResultEvents } from "./live-protocol";

const raw = (value: unknown) => JSON.stringify(value);

describe("parseLiveServerEvent", () => {
  it("maps session.started", () => {
    expect(parseLiveServerEvent(raw({ type: "session.started", event_id: "e1", session: { id: "live_1" } })))
      .toEqual({ kind: "started", sessionId: "live_1" });
  });

  it("maps input and output transcript deltas", () => {
    expect(parseLiveServerEvent(raw({ type: "session.input_transcript.delta", event_id: "e", delta: "I spent", start_ms: 0, end_ms: 1 })))
      .toEqual({ kind: "transcript", role: "user", delta: "I spent" });
    expect(parseLiveServerEvent(raw({ type: "session.output_transcript.delta", event_id: "e", delta: "Okay", start_ms: 0, end_ms: 1 })))
      .toEqual({ kind: "transcript", role: "assistant", delta: "Okay" });
  });

  it("maps a delegated function call", () => {
    const event = raw({
      type: "response.event",
      event_id: "e",
      delegation_id: "item_9",
      event: {
        type: "response.output_item.done",
        item: { type: "function_call", call_id: "call_1", name: "create_transaction_draft", arguments: "{\"type\":\"income\"}" },
      },
    });
    expect(parseLiveServerEvent(event)).toEqual({
      kind: "function_call",
      groupId: "item_9",
      callId: "call_1",
      name: "create_transaction_draft",
      arguments: "{\"type\":\"income\"}",
    });
  });

  it("groups function calls without a delegation id under 'default'", () => {
    const event = raw({
      type: "response.event",
      event_id: "e",
      event: { type: "response.output_item.done", item: { type: "function_call", call_id: "c", name: "n", arguments: "{}" } },
    });
    expect(parseLiveServerEvent(event)).toMatchObject({ kind: "function_call", groupId: "default" });
  });

  it.each([
    ["response.completed", true],
    ["response.failed", false],
    ["response.incomplete", false],
  ])("maps nested %s to response_done (completed: %s)", (type, completed) => {
    expect(parseLiveServerEvent(raw({ type: "response.event", event_id: "e", delegation_id: "item_9", event: { type } })))
      .toEqual({ kind: "response_done", groupId: "item_9", completed });
  });

  it("ignores non-function output items", () => {
    const event = raw({
      type: "response.event",
      event_id: "e",
      event: { type: "response.output_item.done", item: { type: "message", content: [] } },
    });
    expect(parseLiveServerEvent(event)).toBeNull();
  });

  it("maps session.closed with its reason", () => {
    expect(parseLiveServerEvent(raw({ type: "session.closed", event_id: "e", reason: "expired" })))
      .toEqual({ kind: "closed", reason: "expired" });
  });

  it("treats responses_validation_failed as non-fatal and other errors as fatal", () => {
    expect(parseLiveServerEvent(raw({ type: "error", event_id: "e", error: { type: "invalid_request_error", code: "responses_validation_failed", message: "x" } })))
      .toEqual({ kind: "error", fatal: false });
    expect(parseLiveServerEvent(raw({ type: "error", event_id: "e", error: { type: "server_error", code: "internal", message: "x" } })))
      .toEqual({ kind: "error", fatal: true });
  });

  it("returns null for unknown events and malformed JSON", () => {
    expect(parseLiveServerEvent(raw({ type: "session.usage.updated", event_id: "e" }))).toBeNull();
    expect(parseLiveServerEvent("not json")).toBeNull();
    expect(parseLiveServerEvent(raw({ type: "session.input_transcript.delta" }))).toBeNull();
  });
});

describe("runToolCalls", () => {
  it("runs each call in order with parsed arguments", async () => {
    const draft = vi.fn(() => "Staged RM45 income.");
    const find = vi.fn(async () => "Found 2 records.");
    const results = await runToolCalls(
      [
        { callId: "a", name: "create_transaction_draft", arguments: "{\"amount\":45}" },
        { callId: "b", name: "find_transactions", arguments: "{}" },
      ],
      { create_transaction_draft: draft, find_transactions: find },
    );
    expect(draft).toHaveBeenCalledWith({ amount: 45 });
    expect(results).toEqual([
      { callId: "a", output: "Staged RM45 income." },
      { callId: "b", output: "Found 2 records." },
    ]);
  });

  it("does not invoke a tool when arguments are not a JSON object", async () => {
    const tool = vi.fn(() => "ok");
    const results = await runToolCalls(
      [
        { callId: "a", name: "t", arguments: "{oops" },
        { callId: "b", name: "t", arguments: "[1,2]" },
      ],
      { t: tool },
    );
    expect(tool).not.toHaveBeenCalled();
    expect(results.map((result) => result.output)).toEqual([
      "I couldn't read those details. Please say that again.",
      "I couldn't read those details. Please say that again.",
    ]);
  });

  it("answers unknown tools and throwing tools with safe spoken copy", async () => {
    const results = await runToolCalls(
      [
        { callId: "a", name: "missing", arguments: "{}" },
        { callId: "b", name: "boom", arguments: "{}" },
      ],
      { boom: () => { throw new Error("database exploded"); } },
    );
    expect(results).toEqual([
      { callId: "a", output: "That action isn't available." },
      { callId: "b", output: "Something went wrong with that action. Please try again." },
    ]);
  });
});

describe("toolResultEvents", () => {
  it("sends one item per result followed by a single response.create", () => {
    expect(toolResultEvents([{ callId: "a", output: "one" }, { callId: "b", output: "two" }])).toEqual([
      { type: "response.item.create", item: { type: "function_call_output", call_id: "a", output: "one" } },
      { type: "response.item.create", item: { type: "function_call_output", call_id: "b", output: "two" } },
      { type: "response.create" },
    ]);
  });

  it("sends nothing when there are no results", () => {
    expect(toolResultEvents([])).toEqual([]);
  });
});
