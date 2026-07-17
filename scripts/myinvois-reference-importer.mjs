import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { z } from "zod";

export const CANDIDATE_SCHEMA_VERSION = 1;
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_REDIRECTS = 3;
export const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

const nonEmptyString = z.string().min(1);
const codeSchema = z.string().trim().min(1).max(50);
const descriptionSchema = z.string().trim().min(1).max(500);

const describedCodeSchema = z.object({
  Code: nonEmptyString,
  Description: nonEmptyString,
}).strict();

export const MYINVOIS_REFERENCE_SOURCES = Object.freeze([
  source("classification", "ClassificationCodes", describedCodeSchema, "Description"),
  source("country", "CountryCodes", z.object({ Code: nonEmptyString, Country: nonEmptyString }).strict(), "Country"),
  source("currency", "CurrencyCodes", z.object({ Code: nonEmptyString, Currency: nonEmptyString }).strict(), "Currency"),
  source("invoice_type", "EInvoiceTypes", describedCodeSchema, "Description"),
  source("msic", "MSICSubCategoryCodes", z.object({
    Code: nonEmptyString,
    Description: nonEmptyString,
    "MSIC Category Reference": z.string(),
  }).strict(), "Description"),
  source("payment_mode", "PaymentMethods", z.object({ Code: nonEmptyString, "Payment Method": nonEmptyString }).strict(), "Payment Method"),
  source("state", "StateCodes", z.object({ Code: nonEmptyString, State: nonEmptyString }).strict(), "State"),
  source("tax_type", "TaxTypes", describedCodeSchema, "Description"),
  source("unit_of_measurement", "UnitTypes", z.object({ Code: nonEmptyString, Name: nonEmptyString }).strict(), "Name"),
]);

const codeSetSchema = z.enum(MYINVOIS_REFERENCE_SOURCES.map(({ codeSet }) => codeSet));
const sourceMetadataSchema = z.object({
  codeSet: codeSetSchema,
  url: z.string().url().startsWith("https://sdk.myinvois.hasil.gov.my/files/"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  rowCount: z.number().int().positive(),
}).strict();
const normalizedEntrySchema = z.object({
  codeSet: codeSetSchema,
  code: codeSchema,
  description: descriptionSchema,
}).strict();
const candidateWithoutHashSchema = z.object({
  schemaVersion: z.literal(CANDIDATE_SCHEMA_VERSION),
  version: z.string().trim().min(1).max(200),
  retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sources: z.array(sourceMetadataSchema).length(MYINVOIS_REFERENCE_SOURCES.length),
  entries: z.array(normalizedEntrySchema).min(MYINVOIS_REFERENCE_SOURCES.length),
}).strict();
export const candidateArtifactSchema = candidateWithoutHashSchema.extend({
  aggregateSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

function source(codeSet, filename, rowSchema, descriptionField) {
  return Object.freeze({
    codeSet,
    url: `https://sdk.myinvois.hasil.gov.my/files/${filename}.json`,
    rowSchema,
    descriptionField,
  });
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function withoutAggregateHash(candidate) {
  const { aggregateSha256: _aggregateSha256, ...content } = candidate;
  void _aggregateSha256;
  return content;
}

function computeAggregateHash(candidateWithoutHash) {
  return sha256(stableJson(candidateWithoutHash));
}

function compareEntries(left, right) {
  const setOrder = new Map(MYINVOIS_REFERENCE_SOURCES.map(({ codeSet }, index) => [codeSet, index]));
  return (setOrder.get(left.codeSet) - setOrder.get(right.codeSet))
    || (left.code < right.code ? -1 : left.code > right.code ? 1 : 0);
}

function parseRows(definition, rawBytes) {
  let input;
  try {
    input = JSON.parse(rawBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${definition.codeSet}: response was not valid JSON.`, { cause: error });
  }
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`${definition.codeSet}: expected a non-empty top-level array.`);
  }

  const entries = input.map((inputRow, index) => {
    const result = definition.rowSchema.safeParse(inputRow);
    if (!result.success) {
      throw new Error(`${definition.codeSet}: row ${index + 1} did not match the official source schema: ${z.prettifyError(result.error)}`);
    }
    return {
      codeSet: definition.codeSet,
      code: normalizeWhitespace(result.data.Code),
      description: normalizeWhitespace(result.data[definition.descriptionField]),
    };
  });

  const seen = new Map();
  for (const entry of entries) {
    const prior = seen.get(entry.code);
    if (prior !== undefined) {
      const detail = prior === entry.description ? "duplicate code" : "conflicting descriptions";
      throw new Error(`${definition.codeSet}: ${detail} for ${entry.code}.`);
    }
    seen.set(entry.code, entry.description);
  }
  return entries;
}

async function readBoundedResponse(response, maxResponseBytes, codeSet) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    throw new Error(`${codeSet}: response exceeded ${maxResponseBytes} bytes.`);
  }
  if (!response.body) throw new Error(`${codeSet}: response body was empty.`);

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel();
        throw new Error(`${codeSet}: response exceeded ${maxResponseBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new Error(`${codeSet}: response body was empty.`);
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

async function fetchSource(definition, options) {
  let url = definition.url;
  for (let redirects = 0; redirects <= options.maxRedirects; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    let receivedResponse = false;
    try {
      const response = await options.fetchImpl(url, { redirect: "manual", signal: controller.signal });
      receivedResponse = true;
      if (response.status >= 300 && response.status < 400) {
        if (redirects === options.maxRedirects) throw new Error(`${definition.codeSet}: exceeded ${options.maxRedirects} redirects.`);
        const location = response.headers.get("location");
        if (!location) throw new Error(`${definition.codeSet}: redirect response omitted Location.`);
        const redirected = new URL(location, url);
        if (redirected.protocol !== "https:" || redirected.hostname !== "sdk.myinvois.hasil.gov.my") {
          throw new Error(`${definition.codeSet}: refused redirect outside the official HTTPS host.`);
        }
        url = redirected.href;
        continue;
      }
      if (!response.ok) throw new Error(`${definition.codeSet}: ${url} returned HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        throw new Error(`${definition.codeSet}: expected application/json but received ${contentType ?? "no content type"}.`);
      }
      const rawBytes = await readBoundedResponse(response, options.maxResponseBytes, definition.codeSet);
      return { rawBytes, entries: parseRows(definition, rawBytes) };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`${definition.codeSet}: timed out after ${options.timeoutMs} ms for ${url}.`, { cause: error });
      }
      if (!receivedResponse) {
        throw new Error(`${definition.codeSet}: request failed for ${url}.`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${definition.codeSet}: redirect handling failed.`);
}

/**
 * @param {{
 *   version: string,
 *   retrievedAt: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   maxRedirects?: number,
 *   maxResponseBytes?: number,
 * }} options
 */
export async function retrieveCandidate({
  version,
  retrievedAt,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  const identity = candidateWithoutHashSchema.pick({ version: true, retrievedAt: true }).parse({ version, retrievedAt });
  const results = [];
  for (const definition of MYINVOIS_REFERENCE_SOURCES) {
    const result = await fetchSource(definition, { fetchImpl, timeoutMs, maxRedirects, maxResponseBytes });
    results.push({ definition, ...result });
  }

  const content = candidateWithoutHashSchema.parse({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    ...identity,
    sources: results.map(({ definition, rawBytes, entries }) => ({
      codeSet: definition.codeSet,
      url: definition.url,
      sha256: sha256(rawBytes),
      rowCount: entries.length,
    })),
    entries: results.flatMap(({ entries }) => entries).sort(compareEntries),
  });
  return { ...content, aggregateSha256: computeAggregateHash(content) };
}

export function verifyCandidate(candidateInput) {
  const candidate = candidateArtifactSchema.parse(candidateInput);
  const expectedSets = MYINVOIS_REFERENCE_SOURCES.map(({ codeSet }) => codeSet);
  if (candidate.sources.some(({ codeSet }, index) => codeSet !== expectedSets[index])) {
    throw new Error("Candidate sources are missing or not in the registry order.");
  }
  const entries = [...candidate.entries].sort(compareEntries);
  if (JSON.stringify(entries) !== JSON.stringify(candidate.entries)) {
    throw new Error("Candidate entries are not in deterministic order.");
  }
  const keys = candidate.entries.map(({ codeSet, code }) => `${codeSet}:${code}`);
  if (new Set(keys).size !== keys.length) throw new Error("Candidate contains duplicate reference codes.");
  for (const sourceMetadata of candidate.sources) {
    const count = candidate.entries.filter(({ codeSet }) => codeSet === sourceMetadata.codeSet).length;
    if (count !== sourceMetadata.rowCount) {
      throw new Error(`${sourceMetadata.codeSet}: row count does not match normalized entries.`);
    }
  }
  const expectedHash = computeAggregateHash(withoutAggregateHash(candidate));
  if (candidate.aggregateSha256 !== expectedHash) throw new Error("Candidate aggregate SHA-256 does not match its content.");
  return candidate;
}

export async function readAndVerifyCandidate(inputPath) {
  const resolvedPath = resolve(process.cwd(), inputPath);
  let input;
  try {
    input = JSON.parse(await readFile(resolvedPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read candidate ${resolvedPath}.`, { cause: error });
  }
  return verifyCandidate(input);
}

export async function writeCandidateAtomically(outputPath, candidate) {
  verifyCandidate(candidate);
  const resolvedPath = resolve(process.cwd(), outputPath);
  if (!basename(resolvedPath).endsWith(".candidate.json")) {
    throw new Error("Candidate output must end with .candidate.json; reviewed artifacts cannot be overwritten by the refresh command.");
  }
  await mkdir(dirname(resolvedPath), { recursive: true });
  const temporaryPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, stableJson(candidate), { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, resolvedPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return resolvedPath;
}
