import type { EntityId, ISODateTimeString } from "./common";

export type LoanReadinessBand = "not_ready" | "developing" | "ready" | "strong";

export interface LoanReadinessMetric {
  key: string;
  label: string;
  score: number;
  explanation: string;
}

export interface LoanReadinessAssessment {
  businessId: EntityId;
  score: number;
  band: LoanReadinessBand;
  assessedAt: ISODateTimeString;
  metrics: LoanReadinessMetric[];
  recommendations: string[];
  dataCompletenessNote: string;
}
