import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTelegramAudio, TelegramVoiceDownloadError, TelegramVoiceFileTooLargeError } from "./download-file";

let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

describe("downloadTelegramAudio", () => {
  it("rejects oversized files before downloading them", async () => {
    await expect(downloadTelegramAudio({ api: { getFile: vi.fn() }, botToken: "secret", fileId: "file", fileSize: 101, maxBytes: 100 }))
      .rejects.toBeInstanceOf(TelegramVoiceFileTooLargeError);
  });

  it("writes a randomly named temporary file and cleans it up", async () => {
    directory = await mkdtemp(join(tmpdir(), "niagaai-download-"));
    const audio = await downloadTelegramAudio({
      api: { getFile: vi.fn().mockResolvedValue({ file_path: "voice/file.oga" }) },
      botToken: "secret",
      fileId: "file",
      maxBytes: 100,
      temporaryDirectory: directory,
      fetcher: vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    });
    expect(audio.filePath).toMatch(/\.ogg$/);
    await expect(readFile(audio.filePath)).resolves.toEqual(Buffer.from([1, 2, 3]));
    await audio.cleanup();
    await expect(stat(audio.filePath)).rejects.toThrow();
  });

  it("hides Telegram metadata failures behind a safe error", async () => {
    await expect(downloadTelegramAudio({ api: { getFile: vi.fn().mockRejectedValue(new Error("token details")) }, botToken: "secret", fileId: "file", maxBytes: 100 }))
      .rejects.toBeInstanceOf(TelegramVoiceDownloadError);
  });
});
