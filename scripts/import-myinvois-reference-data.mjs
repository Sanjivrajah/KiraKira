import {
  readAndVerifyCandidate,
  retrieveCandidate,
  writeCandidateAtomically,
} from "./myinvois-reference-importer.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const verifyPath = argument("verify");
if (verifyPath) {
  const candidate = await readAndVerifyCandidate(verifyPath);
  console.log(`Verified ${candidate.entries.length} MyInvois reference codes in ${verifyPath}.`);
} else {
  const retrievedAt = argument("retrieved-at");
  const version = argument("version");
  const output = argument("output");
  if (!retrievedAt || !version || !output) {
    throw new Error("Usage: --version <id> --retrieved-at <YYYY-MM-DD> --output <path.candidate.json>\n       --verify <path.candidate.json>");
  }
  const candidate = await retrieveCandidate({ version, retrievedAt });
  const outputPath = await writeCandidateAtomically(output, candidate);
  console.log(`Wrote ${candidate.entries.length} MyInvois reference codes to ${outputPath}.`);
}
