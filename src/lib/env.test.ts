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
    vi.stubEnv("ELEVENLABS_API_KEY", "test-elevenlabs-key");

    expect(getBotEnvironment()).toEqual({
      TELEGRAM_BOT_TOKEN: "test-token",
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_TRANSACTION_MODEL: "gpt-4o-mini",
      ELEVENLABS_API_KEY: "test-elevenlabs-key",
      ELEVENLABS_STT_MODEL: "scribe_v2",
      MAX_VOICE_FILE_BYTES: 20 * 1024 * 1024,
      LOCAL_DATA_DIRECTORY: "./data",
      BOT_PERSISTENCE_MODE: "local",
    });
  });

  it("lists the missing Telegram token without exposing environment values", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_TRANSACTION_MODEL", "");
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    expect(() => getBotEnvironment()).toThrow(EnvironmentValidationError);
    expect(() => getBotEnvironment()).toThrow("TELEGRAM_BOT_TOKEN is required.");
    expect(() => getBotEnvironment()).toThrow("OPENAI_API_KEY is required.");
    expect(() => getBotEnvironment()).toThrow("OPENAI_TRANSACTION_MODEL is required.");
    expect(() => getBotEnvironment()).toThrow("ELEVENLABS_API_KEY is required.");
  });

  it("names an unset required variable", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_TRANSACTION_MODEL", undefined);
    vi.stubEnv("ELEVENLABS_API_KEY", "test-elevenlabs-key");

    expect(() => getBotEnvironment()).toThrow("OPENAI_TRANSACTION_MODEL is required.");
  });
});
