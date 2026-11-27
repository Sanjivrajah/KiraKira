import { z } from "zod";
import type { ClientEvent } from "openai/resources/live/live";

/** The subset of Live server events the voice assistant acts on. */
export type LiveVoiceEvent =
  | { kind: "started"; sessionId: string }
  | { kind: "transcript"; role: "user" | "assistant"; delta: string }
  | { kind: "function_call"; groupId: string; callId: string; name: string; arguments: string }
  /** `completed` is false when the delegated response failed or was cut short. */
  | { kind: "response_done"; groupId: string; completed: boolean }
  | { kind: "closed"; reason: string | null }
  | { kind: "error"; fatal: boolean };

export interface LiveToolCall {
  callId: string;
  name: string;
  arguments: string;
}

export interface LiveToolResult {
  callId: string;
  output: string;
}

export type LiveToolHandler = (parameters: Record<string, unknown>) => Promise<string> | string;

const DEFAULT_GROUP = "default";
const RESPONSE_DONE_TYPES = new Set(["response.completed", "response.failed", "response.incomplete"]);

const startedSchema = z.object({ type: z.literal("session.started"), session: z.object({ id: z.string().min(1) }) });
const transcriptSchema = z.object({
  type: z.enum(["session.input_transcript.delta", "session.output_transcript.delta"]),
  delta: z.string(),
});
const responseEventSchema = z.object({
  type: z.literal("response.event"),
  delegation_id: z.string().min(1).nullish(),
  event: z.object({ type: z.string() }).passthrough(),
});
const functionCallItemSchema = z.object({
  type: z.literal("response.output_item.done"),
  item: z.object({
    type: z.literal("function_call"),
    call_id: z.string().min(1),
    name: z.string().min(1),
    arguments: z.string(),
  }),
});
const closedSchema = z.object({ type: z.literal("session.closed"), reason: z.string().nullish() });
const errorSchema = z.object({ type: z.literal("error"), error: z.object({ code: z.string().nullish() }).passthrough() });

/** Non-fatal per the Live docs: the delegated model rejected a request but the session continues. */
const NON_FATAL_ERROR_CODES = new Set(["responses_validation_failed"]);

/** Translates one raw data-channel message into a typed event, or `null` when it is irrelevant or malformed. */
export function parseLiveServerEvent(raw: string): LiveVoiceEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const type = (value as { type?: unknown } | null)?.type;

  switch (type) {
    case "session.started": {
      const parsed = startedSchema.safeParse(value);
      return parsed.success ? { kind: "started", sessionId: parsed.data.session.id } : null;
    }
    case "session.input_transcript.delta":
    case "session.output_transcript.delta": {
      const parsed = transcriptSchema.safeParse(value);
      if (!parsed.success) return null;
      const role = parsed.data.type === "session.input_transcript.delta" ? "user" : "assistant";
      return { kind: "transcript", role, delta: parsed.data.delta };
    }
    case "response.event": {
      const parsed = responseEventSchema.safeParse(value);
      if (!parsed.success) return null;
      const groupId = parsed.data.delegation_id ?? DEFAULT_GROUP;
      const eventType = parsed.data.event.type;
      if (RESPONSE_DONE_TYPES.has(eventType)) {
        return { kind: "response_done", groupId, completed: eventType === "response.completed" };
      }
      const call = functionCallItemSchema.safeParse(parsed.data.event);
      if (!call.success) return null;
      const { call_id: callId, name, arguments: args } = call.data.item;
      return { kind: "function_call", groupId, callId, name, arguments: args };
    }
    case "session.closed": {
      const parsed = closedSchema.safeParse(value);
      return parsed.success ? { kind: "closed", reason: parsed.data.reason ?? null } : null;
    }
    case "error": {
      const parsed = errorSchema.safeParse(value);
      if (!parsed.success) return null;
      return { kind: "error", fatal: !NON_FATAL_ERROR_CODES.has(parsed.data.error.code ?? "") };
    }
    default:
      return null;
  }
}

function parseArguments(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Runs the model's function calls against the browser tool handlers. Model
 * output is untrusted, so malformed arguments never reach a handler, and every
 * failure becomes short spoken-friendly copy rather than a thrown error.
 */
export async function runToolCalls(
  calls: readonly LiveToolCall[],
  tools: Readonly<Record<string, LiveToolHandler>>,
): Promise<LiveToolResult[]> {
  const results: LiveToolResult[] = [];
  for (const call of calls) {
    const tool = Object.hasOwn(tools, call.name) ? tools[call.name] : undefined;
    if (!tool) {
      results.push({ callId: call.callId, output: "That action isn't available." });
      continue;
    }
    const parameters = parseArguments(call.arguments);
    if (!parameters) {
      results.push({ callId: call.callId, output: "I couldn't read those details. Please say that again." });
      continue;
    }
    try {
      results.push({ callId: call.callId, output: await tool(parameters) });
    } catch {
      results.push({ callId: call.callId, output: "Something went wrong with that action. Please try again." });
    }
  }
  return results;
}

/** One `function_call_output` per result, then a single `response.create` to resume the delegation. */
export function toolResultEvents(results: readonly LiveToolResult[]): ClientEvent[] {
  if (results.length === 0) return [];
  return [
    ...results.map((result): ClientEvent => ({
      type: "response.item.create",
      item: { type: "function_call_output", call_id: result.callId, output: result.output },
    })),
    { type: "response.create" },
  ];
}
