import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvironmentValidationError, getBotEnvironment } from "./env";

describe("getBotEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the bot configuration when it is configured", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_TRANSACTION_MODEL", "gpt-4o-mini");

    expect(getBotEnvironment()).toEqual({
      TELEGRAM_BOT_TOKEN: "test-token",
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_TRANSACTION_MODEL: "gpt-4o-mini",
      LOCAL_DATA_DIRECTORY: "./data",
    });
  });

  it("lists the missing Telegram token without exposing environment values", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_TRANSACTION_MODEL", "");

    expect(() => getBotEnvironment()).toThrow(EnvironmentValidationError);
    expect(() => getBotEnvironment()).toThrow("TELEGRAM_BOT_TOKEN is required.");
    expect(() => getBotEnvironment()).toThrow("OPENAI_API_KEY is required.");
    expect(() => getBotEnvironment()).toThrow("OPENAI_TRANSACTION_MODEL is required.");
  });

  it("names an unset required variable", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_TRANSACTION_MODEL", undefined);

    expect(() => getBotEnvironment()).toThrow("OPENAI_TRANSACTION_MODEL is required.");
  });
});
