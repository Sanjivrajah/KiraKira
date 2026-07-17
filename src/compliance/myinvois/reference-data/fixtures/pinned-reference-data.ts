import artifact from "./official/myinvois-sdk-2026-07-17.json";
import { myInvoisReferenceCodeSchema } from "../reference-code.schema";

const syncedAt = `${artifact.retrievedAt}T00:00:00.000Z`;

export const MYINVOIS_PINNED_REFERENCE_DATA = Object.freeze({
  version: artifact.version,
  retrievedAt: artifact.retrievedAt,
  sourceUrls: Object.freeze([...artifact.sourceUrls]),
  entries: Object.freeze(artifact.entries.map((entry) => myInvoisReferenceCodeSchema.parse({
    ...entry,
    active: true,
    sourceVersion: artifact.version,
    syncedAt,
  }))),
});
