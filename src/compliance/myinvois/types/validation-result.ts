import type { ISODateTime } from "@/domain";

export type MyInvoisValidationSeverity = "info" | "warning" | "error";

export interface MyInvoisValidationResult {
  code: string;
  severity: MyInvoisValidationSeverity;
  fieldPath?: string;
  message: string;
  source: "local" | "myinvois";
  validatedAt: ISODateTime;
}
