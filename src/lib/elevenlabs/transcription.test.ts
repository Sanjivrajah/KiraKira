import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ElevenLabsConfigurationError,
  transcribeAudio,
} from "./transcription";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_STT_MODEL;
});

describe("transcribeAudio", () => {
  it("requires a server-side ElevenLabs key", async () => {
    await expect(transcribeAudio({ bytes: new Uint8Array([1]), filename: "note.webm", mediaType: "audio/webm" }))
      .rejects.toBeInstanceOf(ElevenLabsConfigurationError);
  });

  it("sends audio to Scribe v2 and normalises the transcript", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: "  Bought stock for RM50  ",
      language_code: "eng",
      language_probability: 0.98,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeAudio({ bytes: new Uint8Array([1, 2]), filename: "note.webm", mediaType: "audio/webm" }))
      .resolves.toEqual({ text: "Bought stock for RM50", languageCode: "eng", languageProbability: 0.98 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ "xi-api-key": "test-key" });
    expect((init.body as FormData).get("model_id")).toBe("scribe_v2");
  });

  it("turns provider failures into a typed error", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));

    await expect(transcribeAudio({ bytes: new Uint8Array([1]), filename: "note.mp3", mediaType: "audio/mpeg" }))
      .rejects.toMatchObject({ status: 429 });
  });
});
