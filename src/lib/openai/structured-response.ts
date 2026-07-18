import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

/** Minimal surface the shared helper needs, so callers and tests can inject a fake. */
export type StructuredResponseClient = Pick<OpenAI, "responses">;

/** The exact input-message shape the installed OpenAI Responses API expects. */
export type StructuredResponseInput = Parameters<StructuredResponseClient["responses"]["parse"]>[0]["input"];

export class StructuredResponseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StructuredResponseError";
  }
}

/**
 * Single wrapper for the OpenAI Responses + Zod structured-output idiom used across the
 * transaction and multi-intent extractors. Adds a request timeout and bounded retries so a
 * slow or transiently failing provider call cannot hang a Telegram turn indefinitely.
 */
export async function parseStructuredResponse<Schema extends z.ZodType>({
  client,
  model,
  input,
  schema,
  schemaName,
  timeoutMs,
  maxRetries,
}: {
  client: StructuredResponseClient;
  model: string;
  input: StructuredResponseInput;
  schema: Schema;
  schemaName: string;
  timeoutMs?: number;
  maxRetries?: number;
}): Promise<z.infer<Schema>> {
  const response = await client.responses.parse(
    {
      model,
      store: false,
      input,
      text: { format: zodTextFormat(schema, schemaName) },
    },
    {
      ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
    },
  );

  if (!response.output_parsed) {
    throw new StructuredResponseError(`The model did not return a ${schemaName} result.`);
  }

  return schema.parse(response.output_parsed);
}

/** Convenience builder for the common single text-prompt request. */
export function textInput(prompt: string): StructuredResponseInput {
  return [{ role: "user", content: [{ type: "input_text", text: prompt }] }];
}
