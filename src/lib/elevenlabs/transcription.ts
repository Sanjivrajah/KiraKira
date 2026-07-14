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
  }
}

export async function transcribeAudio({
  bytes,
  filename,
  mediaType,
}: {
  bytes: Uint8Array;
  filename: string;
  mediaType: string;
}): Promise<AudioTranscription> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new ElevenLabsConfigurationError("ELEVENLABS_API_KEY is not configured.");

  const body = new FormData();
  const audioBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  body.set("file", new File([audioBuffer], filename, { type: mediaType }));
  body.set("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  body.set("tag_audio_events", "false");
  body.set("diarize", "false");

  let response: Response;
  try {
    response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new ElevenLabsTranscriptionError(timedOut ? "ElevenLabs transcription timed out." : "ElevenLabs could not be reached.", timedOut ? 504 : 502);
  }

  if (!response.ok) {
    throw new ElevenLabsTranscriptionError("ElevenLabs could not transcribe the audio.", response.status);
  }

  const result = transcriptResponseSchema.safeParse(await response.json());
  if (!result.success || !result.data.text.trim()) {
    throw new ElevenLabsTranscriptionError("ElevenLabs returned an empty transcript.", 502);
  }

  return {
    text: result.data.text.trim(),
    languageCode: result.data.language_code || null,
    languageProbability: result.data.language_probability ?? null,
  };
}
