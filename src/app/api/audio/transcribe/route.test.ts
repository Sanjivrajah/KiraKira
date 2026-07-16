import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/audio/transcribe", () => {
  it("rejects requests that are not multipart form data", async () => {
    const response = await POST(new Request("http://localhost/api/audio/transcribe", { method: "POST" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Send the voice note as multipart form data." });
  });

  it("requires an audio field", async () => {
    const response = await POST(new Request("http://localhost/api/audio/transcribe", {
      method: "POST",
      body: new FormData(),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Record or choose an audio file to continue." });
  });

  it("rejects unsupported files before calling either provider", async () => {
    const body = new FormData();
    body.set("audio", new File(["not audio"], "note.txt", { type: "text/plain" }));
    const response = await POST(new Request("http://localhost/api/audio/transcribe", { method: "POST", body }));
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: "Use an MP3, M4A, WAV, OGG, FLAC, AAC, or WEBM audio file." });
  });
});
