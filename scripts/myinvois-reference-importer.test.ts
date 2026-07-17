import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  MYINVOIS_REFERENCE_SOURCES,
  readAndVerifyCandidate,
  retrieveCandidate,
  verifyCandidate,
  writeCandidateAtomically,
} from "./myinvois-reference-importer.mjs";

const rowsByCodeSet: Record<string, Record<string, string>[]> = {
  classification: [{ Code: "002", Description: "  Child   care " }, { Code: "001", Description: "Breastfeeding equipment" }],
  country: [{ Code: "MYS", Country: "MALAYSIA" }],
  currency: [{ Code: "MYR", Currency: "Malaysian Ringgit" }],
  invoice_type: [{ Code: "01", Description: "Invoice" }],
  msic: [{ Code: "00000", Description: "NOT APPLICABLE", "MSIC Category Reference": "" }],
  payment_mode: [{ Code: "01", "Payment Method": "Cash" }],
  state: [{ Code: "10", State: "Selangor" }],
  tax_type: [{ Code: "02", Description: "Service Tax" }],
  unit_of_measurement: [{ Code: "C62", Name: "one" }],
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function successfulFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const source = MYINVOIS_REFERENCE_SOURCES.find((candidate) => candidate.url === url);
    if (!source) throw new Error(`Unexpected URL ${url}`);
    return jsonResponse(rowsByCodeSet[source.codeSet]);
  });
}

async function candidate(fetchImpl = successfulFetch()) {
  return retrieveCandidate({
    version: "myinvois-sdk-2026-07-18-candidate",
    retrievedAt: "2026-07-18",
    fetchImpl,
  });
}

describe("MyInvois reference candidate importer", () => {
  it("validates all nine source shapes and emits deterministic checksummed content", async () => {
    const first = await candidate();
    const second = await candidate();

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(1);
    expect(first.sources).toHaveLength(9);
    expect(first.sources.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256))).toBe(true);
    expect(first.entries.slice(0, 2)).toEqual([
      { codeSet: "classification", code: "001", description: "Breastfeeding equipment" },
      { codeSet: "classification", code: "002", description: "Child care" },
    ]);
    expect(verifyCandidate(first)).toEqual(first);
  });

  it("rejects malformed top levels, strict-row violations, and duplicate or conflicting codes", async () => {
    const cases = [
      { body: {}, message: "non-empty top-level array" },
      { body: [], message: "non-empty top-level array" },
      { body: [{ Code: "001", Description: "Valid", Extra: "unexpected" }], message: "official source schema" },
      { body: [{ Code: "001", Description: "Same" }, { Code: "001", Description: "Same" }], message: "duplicate code" },
      { body: [{ Code: "001", Description: "First" }, { Code: "001", Description: "Second" }], message: "conflicting descriptions" },
    ];
    for (const testCase of cases) {
      const fetchImpl = successfulFetch();
      fetchImpl.mockResolvedValueOnce(jsonResponse(testCase.body));
      await expect(candidate(fetchImpl)).rejects.toThrow(testCase.message);
    }
  });

  it("rejects non-JSON, oversized, redirected-away, and timed-out responses", async () => {
    const wrongType = successfulFetch();
    wrongType.mockResolvedValueOnce(new Response("<html>", { headers: { "content-type": "text/html" } }));
    await expect(candidate(wrongType)).rejects.toThrow("expected application/json");

    const malformedJson = successfulFetch();
    malformedJson.mockResolvedValueOnce(new Response("not-json", { headers: { "content-type": "application/json" } }));
    await expect(candidate(malformedJson)).rejects.toThrow("not valid JSON");

    const oversized = successfulFetch();
    oversized.mockResolvedValueOnce(new Response("[]", {
      headers: { "content-type": "application/json", "content-length": "100" },
    }));
    await expect(retrieveCandidate({
      version: "candidate", retrievedAt: "2026-07-18", fetchImpl: oversized, maxResponseBytes: 10,
    })).rejects.toThrow("exceeded 10 bytes");

    const redirected = successfulFetch();
    redirected.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://example.com/table.json" } }));
    await expect(candidate(redirected)).rejects.toThrow("outside the official HTTPS host");

    const redirectLoop = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: MYINVOIS_REFERENCE_SOURCES[0].url },
    }));
    await expect(retrieveCandidate({
      version: "candidate", retrievedAt: "2026-07-18", fetchImpl: redirectLoop, maxRedirects: 1,
    })).rejects.toThrow("exceeded 1 redirects");

    const timedOut = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    await expect(retrieveCandidate({
      version: "candidate", retrievedAt: "2026-07-18", fetchImpl: timedOut, timeoutMs: 1,
    })).rejects.toThrow("timed out after 1 ms");
  });

  it("writes candidate files atomically and verifies them without network access", async () => {
    const artifact = await candidate();
    const directory = await mkdtemp(join(tmpdir(), "myinvois-reference-"));
    const output = join(directory, "refresh.candidate.json");

    await expect(writeCandidateAtomically(join(directory, "reviewed.json"), artifact)).rejects.toThrow(".candidate.json");
    await writeCandidateAtomically(output, artifact);
    expect((await readFile(output, "utf8")).endsWith("\n")).toBe(true);
    await expect(readAndVerifyCandidate(output)).resolves.toEqual(artifact);

    const tampered = structuredClone(artifact);
    tampered.entries[0].description = "Tampered";
    expect(() => verifyCandidate(tampered)).toThrow("aggregate SHA-256");
  });
});
