import type { ISODate } from "@/domain";
import type { MyInvoisCodeSetName, MyInvoisReferenceCode } from "./reference-code";

export interface MyInvoisReferenceCatalog {
  readonly entries: readonly MyInvoisReferenceCode[];
  find(codeSet: MyInvoisCodeSetName, code: string): MyInvoisReferenceCode | undefined;
  isActive(codeSet: MyInvoisCodeSetName, code: string, asOfDate: ISODate): boolean;
}

export function createMyInvoisReferenceCatalog(
  entries: readonly MyInvoisReferenceCode[],
): MyInvoisReferenceCatalog {
  const frozenEntries = Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
  const index = new Map(frozenEntries.map((entry) => [`${entry.codeSet}:${entry.code}`, entry]));
  return Object.freeze({
    entries: frozenEntries,
    find: (codeSet: MyInvoisCodeSetName, code: string) => index.get(`${codeSet}:${code}`),
    isActive: (codeSet: MyInvoisCodeSetName, code: string, asOfDate: ISODate) => {
      const entry = index.get(`${codeSet}:${code}`);
      return Boolean(
        entry?.active &&
        (!entry.effectiveFrom || entry.effectiveFrom <= asOfDate) &&
        (!entry.effectiveTo || entry.effectiveTo >= asOfDate),
      );
    },
  });
}
