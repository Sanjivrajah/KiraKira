/**
 * Synthetic regression set for manually or automatically evaluating the model
 * boundary. Assertions intentionally target structured outcomes, never prose.
 */
export type AgentEvaluationFixture = {
  id: string;
  inputKind: "text" | "voice_transcript" | "receipt_image" | "callback";
  input: string;
  expected: {
    intent: "transaction_capture" | "financial_insight" | "invoice_readiness" | "unsupported";
    actionCount: number;
    requiredMissingFields?: string[];
    safeTransition: "awaiting_clarification" | "awaiting_confirmation" | "completed" | "failed" | "duplicate";
  };
};

export const agentEvaluationFixtures: readonly AgentEvaluationFixture[] = [
  { id: "english-sale", inputKind: "text", input: "Sold 10 nasi lemak at RM5 cash today", expected: { intent: "transaction_capture", actionCount: 1, safeTransition: "awaiting_confirmation" } },
  { id: "bahasa-expense", inputKind: "text", input: "Beli stok RM42 tunai semalam", expected: { intent: "transaction_capture", actionCount: 1, safeTransition: "awaiting_confirmation" } },
  { id: "manglish-payment", inputKind: "text", input: "Ravi already bank in RM450 for catering semalam", expected: { intent: "transaction_capture", actionCount: 1, safeTransition: "awaiting_confirmation" } },
  { id: "spelling-mistake", inputKind: "text", input: "sld nasi lmak rm20 cash tdy", expected: { intent: "transaction_capture", actionCount: 1, safeTransition: "awaiting_confirmation" } },
  { id: "multiple-transactions", inputKind: "text", input: "Sold drinks RM80 cash and bought ice RM18", expected: { intent: "transaction_capture", actionCount: 2, safeTransition: "awaiting_confirmation" } },
  { id: "missing-fields", inputKind: "text", input: "Bought supplies", expected: { intent: "transaction_capture", actionCount: 1, requiredMissingFields: ["amount", "transactionDate", "paymentMethod"], safeTransition: "awaiting_clarification" } },
  { id: "ambiguous-customer", inputKind: "text", input: "Ali paid me RM50", expected: { intent: "transaction_capture", actionCount: 1, requiredMissingFields: ["transactionDate", "paymentMethod"], safeTransition: "awaiting_clarification" } },
  { id: "partial-payment", inputKind: "text", input: "Customer paid RM100 for the RM250 invoice", expected: { intent: "transaction_capture", actionCount: 1, safeTransition: "awaiting_confirmation" } },
  { id: "invoice-readiness", inputKind: "text", input: "Prepare an invoice for Kedai Ali", expected: { intent: "invoice_readiness", actionCount: 0, safeTransition: "awaiting_clarification" } },
  { id: "insight-query", inputKind: "text", input: "What was my profit this month?", expected: { intent: "financial_insight", actionCount: 0, safeTransition: "completed" } },
  { id: "receipt-image", inputKind: "receipt_image", input: "Synthetic JPG receipt: Kedai Ali, RM20 cash", expected: { intent: "transaction_capture", actionCount: 1, safeTransition: "awaiting_confirmation" } },
  { id: "voice-transcript", inputKind: "voice_transcript", input: "jualan kuih RM35 cash hari ini", expected: { intent: "transaction_capture", actionCount: 1, safeTransition: "awaiting_confirmation" } },
  { id: "replayed-update", inputKind: "callback", input: "repeat confirm callback for the same draft", expected: { intent: "transaction_capture", actionCount: 0, safeTransition: "duplicate" } },
  { id: "provider-failure", inputKind: "text", input: "OpenAI extraction times out", expected: { intent: "transaction_capture", actionCount: 0, safeTransition: "failed" } },
];
