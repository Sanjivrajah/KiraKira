import { z } from "zod";

function requiredEnvironmentString(name: string) {
  return z.string({ error: `${name} is required.` }).trim().min(1, `${name} is required.`);
}

const botEnvironmentSchema = z.object({
  TELEGRAM_BOT_TOKEN: requiredEnvironmentString("TELEGRAM_BOT_TOKEN"),
  OPENAI_API_KEY: requiredEnvironmentString("OPENAI_API_KEY"),
  OPENAI_TRANSACTION_MODEL: requiredEnvironmentString("OPENAI_TRANSACTION_MODEL"),
  ELEVENLABS_API_KEY: requiredEnvironmentString("ELEVENLABS_API_KEY"),
  ELEVENLABS_STT_MODEL: z.string().trim().min(1).default("scribe_v2"),
  MAX_VOICE_FILE_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  LOCAL_DATA_DIRECTORY: z.string().trim().min(1).default("./data"),
  BOT_PERSISTENCE_MODE: z.enum(["local", "supabase"]).default("local"),
});

export type BotEnvironment = Omit<z.infer<typeof botEnvironmentSchema>, "BOT_PERSISTENCE_MODE"> & {
  /** Optional only for injected legacy test/local environments; parsing fills local. */
  BOT_PERSISTENCE_MODE?: "local" | "supabase";
};

export class EnvironmentValidationError extends Error {
  constructor(messages: string[]) {
    super(`Telegram bot configuration is invalid:\n${messages.map((message) => `- ${message}`).join("\n")}`);
    this.name = "EnvironmentValidationError";
  }
}

export function getBotEnvironment(environment: NodeJS.ProcessEnv = process.env): BotEnvironment {
  const result = botEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new EnvironmentValidationError(result.error.issues.map((issue) => issue.message));
  }

  return result.data;
}
