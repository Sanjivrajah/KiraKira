import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";

const transcriptResponseSchema = z.object({
  text: z.string(),
  language_code: z.string().nullable().optional(),
  language_probability: z.number().nullable().optional(),
});

export interface AudioTranscription {
  text: string;
  languageCode: string | null;
  languageProbability: number | null;
}

export class ElevenLabsConfigurationError extends Error {}

export class ElevenLabsTranscriptionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ElevenLabsTranscriptionError";
  }
}

export function normaliseTranscriptionResponse(response: unknown): AudioTranscription {
  const result = transcriptResponseSchema.safeParse(response);
  if (!result.success || !result.data.text.trim()) throw new ElevenLabsTranscriptionError("ElevenLabs returned an empty or malformed transcript.", 502);
  return {
    text: result.data.text.trim(),
    languageCode: result.data.language_code || null,
    languageProbability: result.data.language_probability ?? null,
  };
}

export class ElevenLabsTranscriptionService {
  constructor(private readonly configuration: { apiKey: string; model: string; fetcher?: typeof fetch }) {
    if (!configuration.apiKey.trim()) throw new ElevenLabsConfigurationError("ELEVENLABS_API_KEY is not configured.");
  }

  async transcribeAudio({ filePath, filename = basename(filePath), mediaType = "audio/ogg" }: { filePath: string; filename?: string; mediaType?: string }): Promise<AudioTranscription> {
    let bytes: Uint8Array;
    try {
      bytes = await readFile(filePath);
    } catch {
      throw new ElevenLabsTranscriptionError("Audio file could not be read for transcription.", 500);
    }
    return this.transcribeBytes({ bytes, filename, mediaType });
  }

  async transcribeBytes({ bytes, filename, mediaType }: { bytes: Uint8Array; filename: string; mediaType: string }): Promise<AudioTranscription> {
    const body = new FormData();
    const audioBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    body.set("file", new File([audioBuffer], filename, { type: mediaType }));
    body.set("model_id", this.configuration.model);
    body.set("tag_audio_events", "false");
    body.set("diarize", "false");

    let response: Response;
    try {
      response = await (this.configuration.fetcher ?? fetch)("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": this.configuration.apiKey },
        body,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
      throw new ElevenLabsTranscriptionError(timedOut ? "ElevenLabs transcription timed out." : "ElevenLabs could not be reached.", timedOut ? 504 : 502);
    }
    if (!response.ok) throw new ElevenLabsTranscriptionError("ElevenLabs could not transcribe the audio.", response.status);
    try {
      return normaliseTranscriptionResponse(await response.json());
    } catch (error) {
      if (error instanceof ElevenLabsTranscriptionError) throw error;
      throw new ElevenLabsTranscriptionError("ElevenLabs returned a malformed transcription response.", 502);
    }
  }
}

/** Compatibility entry point for the existing web voice-upload route. */
export async function transcribeAudio(input: { bytes: Uint8Array; filename: string; mediaType: string }): Promise<AudioTranscription> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new ElevenLabsConfigurationError("ELEVENLABS_API_KEY is not configured.");
  return new ElevenLabsTranscriptionService({ apiKey, model: process.env.ELEVENLABS_STT_MODEL || "scribe_v2" }).transcribeBytes(input);
}
