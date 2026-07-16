import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  ElevenLabsConfigurationError,
  ElevenLabsTranscriptionError,
  transcribeAudio,
} from "@/lib/elevenlabs/transcription";
import {
  extractTransactionFromTranscript,
  VoiceTransactionExtractionConfigurationError,
} from "@/lib/openai/voice-transaction-extraction";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARACTERS = 6_000;
const supportedAudioTypes = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);
const supportedExtensions = [".aac", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav", ".webm"];

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null
    && typeof value !== "string"
    && typeof value.arrayBuffer === "function"
    && typeof value.name === "string";
}

function malaysiaDate() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function POST(request: Request) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Send the voice note as multipart form data." }, { status: 400 });
    }

    const audio = formData.get("audio");
    if (!isUploadedFile(audio)) {
      return NextResponse.json({ error: "Record or choose an audio file to continue." }, { status: 400 });
    }
    const lowerName = audio.name.toLowerCase();
    if (!supportedAudioTypes.has(audio.type) && !supportedExtensions.some((extension) => lowerName.endsWith(extension))) {
      return NextResponse.json({ error: "Use an MP3, M4A, WAV, OGG, FLAC, AAC, or WEBM audio file." }, { status: 415 });
    }
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Use an audio file between 1 byte and 25 MB." }, { status: 413 });
    }

    const transcription = await transcribeAudio({
      bytes: new Uint8Array(await audio.arrayBuffer()),
      filename: audio.name.slice(0, 120) || "voice-note.webm",
      mediaType: audio.type || "application/octet-stream",
    });
    if (transcription.text.length > MAX_TRANSCRIPT_CHARACTERS) {
      return NextResponse.json({ error: "This voice note is too long. Use one transaction per note and keep it under 3 minutes." }, { status: 413 });
    }
    const extraction = await extractTransactionFromTranscript({
      transcript: transcription.text,
      currentDate: malaysiaDate(),
    });

    if (!extraction.relevant) {
      return NextResponse.json({
        error: "We transcribed the audio, but it does not appear to describe a business transaction.",
        transcript: transcription.text,
      }, { status: 422 });
    }

    const warnings = [...extraction.warnings];
    if (extraction.type === "unknown") warnings.push("Money in or money out was unclear. Check the transaction type.");
    if (extraction.currency !== "MYR") warnings.push("The currency was not clearly Malaysian ringgit. Confirm the amount in RM.");
    if (!extraction.date) warnings.push("No transaction date was clear. Choose the date before saving.");
    if (extraction.amount === null) warnings.push("No amount was clear. Enter the amount before saving.");

    return NextResponse.json({
      transcript: transcription.text,
      languageCode: transcription.languageCode,
      languageProbability: transcription.languageProbability,
      warnings: Array.from(new Set(warnings)).map((warning) => warning.slice(0, 240)),
      draft: {
        type: extraction.type === "income" ? "income" : "expense",
        date: extraction.date,
        amount: extraction.amount ?? undefined,
        category: (extraction.category || "Uncategorised").slice(0, 60),
        description: (extraction.description || transcription.text).slice(0, 160),
        counterpartyName: extraction.counterpartyName.slice(0, 100),
        paymentMethod: extraction.paymentMethod.slice(0, 60),
        source: "voice" as const,
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsConfigurationError) {
      return NextResponse.json({ error: "Speech-to-text is not configured." }, { status: 503 });
    }
    if (error instanceof VoiceTransactionExtractionConfigurationError) {
      return NextResponse.json({ error: "Voice transaction extraction is not configured." }, { status: 503 });
    }
    if (error instanceof ElevenLabsTranscriptionError) {
      const status = error.status === 429 ? 429 : error.status === 504 ? 504 : 502;
      return NextResponse.json({ error: status === 429 ? "Speech-to-text is busy. Wait a moment and try again." : "We could not transcribe this voice note." }, { status });
    }
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI voice transaction extraction failed", {
        status: error.status,
        requestId: error.requestID,
        code: error.code,
      });
      return NextResponse.json({ error: "We transcribed the audio but could not structure the transaction." }, { status: 502 });
    }

    console.error("Voice-note processing failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "We could not process this voice note." }, { status: 500 });
  }
}
