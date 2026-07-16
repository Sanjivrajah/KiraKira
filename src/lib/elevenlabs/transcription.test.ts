import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsConfigurationError, ElevenLabsTranscriptionError, ElevenLabsTranscriptionService, normaliseTranscriptionResponse } from "./transcription";

let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

describe("ElevenLabsTranscriptionService", () => {
  it("normalises a multilingual transcription response", () => {
    expect(normaliseTranscriptionResponse({ text: "  Beli ayam RM85  ", language_code: "msa", language_probability: 0.98 }))
      .toEqual({ text: "Beli ayam RM85", languageCode: "msa", languageProbability: 0.98 });
  });

  it("rejects an empty transcription", () => {
    expect(() => normaliseTranscriptionResponse({ text: "   " })).toThrow(ElevenLabsTranscriptionError);
  });

  it("uses the configured Scribe model without calling the network in tests", async () => {
    directory = await mkdtemp(join(tmpdir(), "niagaai-stt-"));
    const filePath = join(directory, "voice.ogg");
    await writeFile(filePath, new Uint8Array([1, 2]));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "Bought stock for RM50" }), { status: 200 }));
    const service = new ElevenLabsTranscriptionService({ apiKey: "test-key", model: "scribe_v2", fetcher });

    await expect(service.transcribeAudio({ filePath, mediaType: "audio/ogg" })).resolves.toMatchObject({ text: "Bought stock for RM50" });
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ "xi-api-key": "test-key" });
    expect((init.body as FormData).get("model_id")).toBe("scribe_v2");
  });

  it("rejects a missing API key", () => {
    expect(() => new ElevenLabsTranscriptionService({ apiKey: "", model: "scribe_v2" })).toThrow(ElevenLabsConfigurationError);
  });

  it("turns a mocked ElevenLabs provider failure into a safe typed error", async () => {
    directory = await mkdtemp(join(tmpdir(), "niagaai-stt-"));
    const filePath = join(directory, "voice.ogg");
    await writeFile(filePath, new Uint8Array([1]));
    const service = new ElevenLabsTranscriptionService({ apiKey: "test-key", model: "scribe_v2", fetcher: vi.fn().mockResolvedValue(new Response("invalid key", { status: 401 })) });
    await expect(service.transcribeAudio({ filePath })).rejects.toMatchObject({ name: "ElevenLabsTranscriptionError", status: 401 });
  });
});
