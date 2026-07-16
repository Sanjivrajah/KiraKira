import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MAX_TELEGRAM_RECEIPT_BYTES = 10 * 1024 * 1024;
export type SupportedReceiptMediaType = "image/jpeg" | "image/png" | "image/webp";

export class TelegramReceiptDownloadError extends Error {}
export class TelegramReceiptFileTooLargeError extends TelegramReceiptDownloadError {}
export class TelegramReceiptUnsupportedTypeError extends TelegramReceiptDownloadError {}

export type DownloadedTelegramReceipt = {
  bytes: Uint8Array;
  filePath: string;
  filename: string;
  mediaType: SupportedReceiptMediaType;
  cleanup: () => Promise<void>;
};

const extensions: Record<SupportedReceiptMediaType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function detectReceiptMediaType(bytes: Uint8Array): SupportedReceiptMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

async function readWithinLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new TelegramReceiptFileTooLargeError();
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
      if (total > maxBytes) throw new TelegramReceiptFileTooLargeError();
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

export async function downloadTelegramReceipt({
  api,
  botToken,
  fileId,
  fileSize,
  maxBytes = MAX_TELEGRAM_RECEIPT_BYTES,
  fetcher = fetch,
  temporaryDirectory = join(tmpdir(), "niagaai-telegram-receipts"),
}: {
  api: { getFile(fileId: string): Promise<{ file_path?: string }> };
  botToken: string;
  fileId: string;
  fileSize?: number;
  maxBytes?: number;
  fetcher?: typeof fetch;
  temporaryDirectory?: string;
}): Promise<DownloadedTelegramReceipt> {
  if (fileSize !== undefined && fileSize > maxBytes) throw new TelegramReceiptFileTooLargeError();

  let metadata: { file_path?: string };
  try { metadata = await api.getFile(fileId); }
  catch { throw new TelegramReceiptDownloadError(); }
  if (!metadata.file_path) throw new TelegramReceiptDownloadError();

  let response: Response;
  try { response = await fetcher(`https://api.telegram.org/file/bot${botToken}/${metadata.file_path}`); }
  catch { throw new TelegramReceiptDownloadError(); }
  if (!response.ok) throw new TelegramReceiptDownloadError();
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new TelegramReceiptFileTooLargeError();

  const bytes = await readWithinLimit(response, maxBytes);
  const mediaType = detectReceiptMediaType(bytes);
  if (!mediaType) throw new TelegramReceiptUnsupportedTypeError();
  const filename = `${randomUUID()}${extensions[mediaType]}`;
  const filePath = join(temporaryDirectory, filename);
  try {
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(filePath, bytes);
  } catch {
    throw new TelegramReceiptDownloadError();
  }
  return { bytes, filePath, filename, mediaType, cleanup: async () => { await rm(filePath, { force: true }); } };
}
