export const LOAN_READINESS_DISCLAIMER = "Demo estimate based on current local records — not a financing decision.";

export const LOAN_READINESS_WEIGHTS = {
  startingScore: 20,
  transactionHistory: 20,
  incomeAndExpenses: 15,
  reviewedRecords: 15,
  invoiceHistory: 10,
  noOverdueInvoices: 10,
  registrationNumber: 5,
  taxIdentificationNumber: 5,
} as const;
