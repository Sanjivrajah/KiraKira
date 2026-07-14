import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/imports/bank-statement", () => {
  it("rejects requests that are not multipart form data", async () => {
    const response = await POST(new Request("http://localhost/api/imports/bank-statement", { method: "POST" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Send the statement as multipart form data." });
  });

  it("requires a statement field", async () => {
    const response = await POST(new Request("http://localhost/api/imports/bank-statement", {
      method: "POST",
      body: new FormData(),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Choose a PDF bank statement to continue." });
  });

  it("rejects non-PDF files before calling OpenAI", async () => {
    const body = new FormData();
    body.set("statement", new File(["date,amount"], "statement.csv", { type: "text/csv" }));
    const response = await POST(new Request("http://localhost/api/imports/bank-statement", { method: "POST", body }));
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: "Use a PDF statement, or import a bank CSV instead." });
  });
});
