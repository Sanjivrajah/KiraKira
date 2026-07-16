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

export function readinessGroupReady(
  actions: ReadinessAction[],
  prerequisites: ReadinessAction[] = [],
): boolean {
  return [...prerequisites, ...actions].every(
    (action) => action.severity !== "error" || action.ready,
  );
}
