export interface ReadinessAction {
  id: string;
  label: string;
  ready: boolean;
  severity: "error" | "warning";
  fieldPath: string;
  message: string;
  confidence?: number;
}

export interface FrontendReadinessViewModel {
  bookkeeping: ReadinessAction[];
  invoice: ReadinessAction[];
  myInvoisSubmission: ReadinessAction[];
}

export function readinessGroupReady(actions: ReadinessAction[]): boolean {
  return actions.every((action) => action.severity !== "error" || action.ready);
}

