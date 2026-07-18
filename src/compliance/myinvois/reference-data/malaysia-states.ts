export const MALAYSIA_STATE_OPTIONS = Object.freeze([
  { value: "01", label: "Johor" },
  { value: "02", label: "Kedah" },
  { value: "03", label: "Kelantan" },
  { value: "04", label: "Melaka" },
  { value: "05", label: "Negeri Sembilan" },
  { value: "06", label: "Pahang" },
  { value: "07", label: "Pulau Pinang" },
  { value: "08", label: "Perak" },
  { value: "09", label: "Perlis" },
  { value: "10", label: "Selangor" },
  { value: "11", label: "Terengganu" },
  { value: "12", label: "Sabah" },
  { value: "13", label: "Sarawak" },
  { value: "14", label: "Wilayah Persekutuan Kuala Lumpur" },
  { value: "15", label: "Wilayah Persekutuan Labuan" },
  { value: "16", label: "Wilayah Persekutuan Putrajaya" },
  { value: "17", label: "Not Applicable" },
] as const);

export const MALAYSIA_ADDRESS_STATE_OPTIONS = Object.freeze(
  MALAYSIA_STATE_OPTIONS.filter((option) => option.value !== "17"),
);

const stateCodeByNormalizedLabel = new Map(
  MALAYSIA_STATE_OPTIONS.map((option) => [option.label.toLocaleLowerCase("en-MY"), option.value]),
);

export function normalizeMalaysiaStateCode(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (MALAYSIA_STATE_OPTIONS.some((option) => option.value === trimmed)) return trimmed;
  return stateCodeByNormalizedLabel.get(trimmed.toLocaleLowerCase("en-MY")) ?? trimmed;
}

export function isMalaysiaAddressStateCode(value: string | undefined): boolean {
  return MALAYSIA_ADDRESS_STATE_OPTIONS.some((option) => option.value === value);
}
