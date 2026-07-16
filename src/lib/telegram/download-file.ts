import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const temporaryDirectoryName = "niagaai-telegram-voice";

export class TelegramVoiceDownloadError extends Error {}
export class TelegramVoiceFileTooLargeError extends TelegramVoiceDownloadError {}

export type DownloadedTelegramAudio = {
  filePath: string;
  filename: string;
  mediaType: string;
  cleanup: () => Promise<void>;
};

function extensionFor(mediaType: string | undefined): { extension: string; mediaType: string } {
  if (mediaType === "audio/mpeg") return { extension: ".mp3", mediaType };
  if (mediaType === "audio/mp4") return { extension: ".m4a", mediaType };
  return { extension: ".ogg", mediaType: "audio/ogg" };
}

async function readResponseWithinLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new TelegramVoiceFileTooLargeError("Voice note exceeds the configured size limit.");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new TelegramVoiceFileTooLargeError("Voice note exceeds the configured size limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function downloadTelegramAudio({
  api,
  botToken,
  fileId,
  fileSize,
  mediaType,
  maxBytes,
  fetcher = fetch,
  temporaryDirectory = join(tmpdir(), temporaryDirectoryName),
}: {
  api: { getFile(fileId: string): Promise<{ file_path?: string }> };
  botToken: string;
  fileId: string;
  fileSize?: number;
  mediaType?: string;
  maxBytes: number;
  fetcher?: typeof fetch;
  temporaryDirectory?: string;
}): Promise<DownloadedTelegramAudio> {
  if (fileSize !== undefined && fileSize > maxBytes) throw new TelegramVoiceFileTooLargeError("Voice note exceeds the configured size limit.");

  let metadata: { file_path?: string };
  try {
    metadata = await api.getFile(fileId);
  } catch {
    throw new TelegramVoiceDownloadError("Telegram file metadata could not be retrieved.");
  }
  if (!metadata.file_path) throw new TelegramVoiceDownloadError("Telegram did not provide a voice file path.");

  let response: Response;
  try {
    response = await fetcher(`https://api.telegram.org/file/bot${botToken}/${metadata.file_path}`);
  } catch {
    throw new TelegramVoiceDownloadError("Telegram voice file could not be downloaded.");
  }
  if (!response.ok) throw new TelegramVoiceDownloadError("Telegram voice file could not be downloaded.");
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new TelegramVoiceFileTooLargeError("Voice note exceeds the configured size limit.");

  const bytes = await readResponseWithinLimit(response, maxBytes);
  const safeType = extensionFor(mediaType);
  const filename = `${randomUUID()}${safeType.extension}`;
  const filePath = join(temporaryDirectory, filename);
  try {
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(filePath, bytes);
  } catch {
    throw new TelegramVoiceDownloadError("Temporary voice file could not be created.");
  }
  return { filePath, filename, mediaType: safeType.mediaType, cleanup: async () => { await rm(filePath, { force: true }); } };
}
