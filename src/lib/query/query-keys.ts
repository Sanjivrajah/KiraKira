export const queryKeys = {
  business: (businessId: string) => ["business", businessId] as const,
  businessForUser: (userId: string) => ["business", "user", userId] as const,
  transactions: {
    all: ["transactions"] as const,
    list: (businessId: string) => ["transactions", businessId, "list"] as const,
    detail: (businessId: string, transactionId: string) => ["transactions", businessId, "detail", transactionId] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (businessId: string) => ["invoices", businessId, "list"] as const,
    detail: (businessId: string, invoiceId: string) => ["invoices", businessId, "detail", invoiceId] as const,
  },
  eInvoices: {
    all: ["e-invoices"] as const,
    workspace: (businessId: string) => ["e-invoices", businessId, "workspace"] as const,
    submissions: (businessId: string) => ["e-invoices", businessId, "submissions"] as const,
  },
  reminders: {
    all: ["reminders"] as const,
    list: (businessId: string) => ["reminders", businessId, "list"] as const,
  },
  dashboard: (businessId: string) => ["dashboard", businessId] as const,
  loanReadiness: (businessId: string) => ["loan-readiness", businessId] as const,
} as const;
