import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/vision/receipts", () => {
  it("rejects requests that are not multipart form data", async () => {
    const response = await POST(new Request("http://localhost/api/vision/receipts", { method: "POST" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Send the receipt as multipart form data." });
  });

  it("requires an image field", async () => {
    const response = await POST(new Request("http://localhost/api/vision/receipts", {
      method: "POST",
      body: new FormData(),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Choose a receipt image to continue." });
  });
});
