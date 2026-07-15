import { z } from "zod";

function requiredEnvironmentString(name: string) {
  return z.string({ error: `${name} is required.` }).trim().min(1, `${name} is required.`);
}

const botEnvironmentSchema = z.object({
  TELEGRAM_BOT_TOKEN: requiredEnvironmentString("TELEGRAM_BOT_TOKEN"),
  OPENAI_API_KEY: requiredEnvironmentString("OPENAI_API_KEY"),
  OPENAI_TRANSACTION_MODEL: requiredEnvironmentString("OPENAI_TRANSACTION_MODEL"),
  LOCAL_DATA_DIRECTORY: z.string().trim().min(1).default("./data"),
});

export type BotEnvironment = z.infer<typeof botEnvironmentSchema>;

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
