import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDefinitions = [
  ["classification", "ClassificationCodes"],
  ["country", "CountryCodes"],
  ["currency", "CurrencyCodes"],
  ["invoice_type", "EInvoiceTypes"],
  ["msic", "MSICSubCategoryCodes"],
  ["payment_mode", "PaymentMethods"],
  ["state", "StateCodes"],
  ["tax_type", "TaxTypes"],
  ["unit_of_measurement", "UnitTypes"],
];

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const retrievedAt = argument("retrieved-at");
const version = argument("version");
const output = argument("output");
if (!retrievedAt || !/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt) || !version || !output) {
  throw new Error("Usage: --version <id> --retrieved-at <YYYY-MM-DD> --output <path>");
}

const sources = sourceDefinitions.map(([codeSet, filename]) => ({
  codeSet,
  url: `https://sdk.myinvois.hasil.gov.my/files/${filename}.json`,
}));

const importedEntries = (await Promise.all(sources.map(async ({ codeSet, url }) => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${url} did not contain a non-empty array.`);
  return rows.map((row) => {
    const code = row.Code ?? row.code;
    const description = row.Description ?? row.description ?? row.Country ?? row.Currency ?? row.State ?? row["Payment Method"] ?? row.Name;
    if (typeof code !== "string" || !code.trim() || typeof description !== "string" || !description.trim()) {
      throw new Error(`${url} contains an unrecognised code-table row.`);
    }
    return { codeSet, code: code.trim(), description: description.trim() };
  });
}))).flat();

const uniqueEntries = new Map();
for (const entry of importedEntries) {
  const key = `${entry.codeSet}:${entry.code}`;
  const prior = uniqueEntries.get(key);
  if (prior && prior.description !== entry.description) {
    throw new Error(`Conflicting reference code ${key}.`);
  }
  uniqueEntries.set(key, entry);
}
const entries = [...uniqueEntries.values()];

const artifact = {
  version,
  retrievedAt,
  sourceUrls: sources.map(({ url }) => url),
  entries,
};
const outputPath = resolve(process.cwd(), output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${entries.length} MyInvois reference codes to ${outputPath}.`);
