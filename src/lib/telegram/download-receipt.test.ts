import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectReceiptMediaType, downloadTelegramReceipt, TelegramReceiptFileTooLargeError, TelegramReceiptUnsupportedTypeError } from "./download-receipt";

let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("downloadTelegramReceipt", () => {
  it("detects supported content from magic bytes rather than a filename", () => {
    expect(detectReceiptMediaType(png)).toBe("image/png");
    expect(detectReceiptMediaType(new Uint8Array([0xff, 0xd8, 0xff, 1]))).toBe("image/jpeg");
    expect(detectReceiptMediaType(new TextEncoder().encode("RIFF1234WEBP"))).toBe("image/webp");
    expect(detectReceiptMediaType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("rejects oversized metadata before downloading", async () => {
    const getFile = vi.fn();
    await expect(downloadTelegramReceipt({ api: { getFile }, botToken: "secret", fileId: "file", fileSize: 101, maxBytes: 100 }))
      .rejects.toBeInstanceOf(TelegramReceiptFileTooLargeError);
    expect(getFile).not.toHaveBeenCalled();
  });

  it("writes an actual image to a randomly named temporary file and cleans it up", async () => {
    directory = await mkdtemp(join(tmpdir(), "niagaai-receipt-download-"));
    const receipt = await downloadTelegramReceipt({
      api: { getFile: vi.fn().mockResolvedValue({ file_path: "documents/not-really-a-pdf.pdf" }) },
      botToken: "secret",
      fileId: "file",
      temporaryDirectory: directory,
      fetcher: vi.fn().mockResolvedValue(new Response(png)),
    });
    expect(receipt.mediaType).toBe("image/png");
    expect(receipt.filename).toMatch(/\.png$/);
    await expect(readFile(receipt.filePath)).resolves.toEqual(Buffer.from(png));
    await receipt.cleanup();
    await expect(stat(receipt.filePath)).rejects.toThrow();
  });

  it("rejects content whose bytes are not a supported image", async () => {
    await expect(downloadTelegramReceipt({
      api: { getFile: vi.fn().mockResolvedValue({ file_path: "documents/receipt.jpg" }) },
      botToken: "secret",
      fileId: "file",
      fetcher: vi.fn().mockResolvedValue(new Response(new TextEncoder().encode("not an image"))),
    })).rejects.toBeInstanceOf(TelegramReceiptUnsupportedTypeError);
  });
});
