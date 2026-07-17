import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EInvoiceWorkspace as Workspace } from "@/application/e-invoices";
import { EInvoiceWorkspace } from "./e-invoice-workspace";

let mode: "demo" | "supabase" = "supabase";
let data: Workspace;

vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ mode }) }));
vi.mock("@/hooks/use-business", () => ({ useBusiness: () => ({ data: { id: "business-1" }, isPending: false, isError: false }) }));
vi.mock("@/hooks/use-e-invoices", () => ({
  useEInvoiceWorkspace: () => ({ data, isPending: false, isError: false, refetch: vi.fn() }),
  usePrepareEInvoices: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSaveEInvoiceFields: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useApproveEInvoice: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCreateEInvoiceRevision: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useEInvoiceSubmissions: () => ({ data: { environment: "sandbox", taxpayerIdentity: "C1234567890", candidates: [], submissions: [] }, isPending: false, isError: false, refetch: vi.fn() }),
  useSubmitEInvoices: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useGenerateEInvoiceSandboxPayload: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRefreshEInvoiceSubmission: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

beforeEach(() => {
  mode = "supabase";
  data = {
    candidates: [{ id: "invoice-1", invoiceNumber: "INV-100", documentType: "invoice", issueDate: "2026-07-17", currency: "USD", paymentStatus: "sent", revision: 1, eligible: true, ineligibilityReasons: [], preparationId: "prep-1", preparationStatus: "needs_information" }],
    preparations: [{
      id: "prep-1", businessId: "business-1", sourceInvoiceId: "invoice-1", sourceInvoiceRevision: 1,
      documentType: "invoice", documentVersion: "1.1", scenario: "foreign_currency", hasCanonicalDocument: false,
      supplementalFields: {}, status: "needs_information", revision: 2,
      readinessResult: { ready: false, validatedAt: "2026-07-17T10:00:00.000Z", checkLabel: "NiagaAI internal preparation checks", diagnostics: [{ code: "missing", fieldPath: "document.exchangeRate", message: "Exchange rate is required.", severity: "error", group: "document", sourceReferenceLabel: "MyInvois Invoice v1.1" }] },
      active: true, submissionEligible: false, createdAt: "2026-07-17T10:00:00.000Z", updatedAt: "2026-07-17T10:00:00.000Z",
    }],
    counts: { selected: 0, needsInformation: 1, ready: 0, approved: 0 },
  };
});

describe("EInvoiceWorkspace", () => {
  it("keeps the browser demo honest instead of simulating approvals", () => {
    mode = "demo";
    render(<EInvoiceWorkspace />);
    expect(screen.getByRole("heading", { name: "Supabase workspace required" })).toBeInTheDocument();
    expect(screen.getByText(/does not simulate e-Invoice approvals or submissions/i)).toBeInTheDocument();
  });

  it("shows conditional fields and explicitly labels checks as internal", () => {
    render(<EInvoiceWorkspace />);
    expect(screen.getByRole("spinbutton", { name: /Exchange rate to MYR/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Customs Form No. 1 or 9 reference/ })).not.toBeInTheDocument();
    expect(screen.getByText("These are internal checks, not official MyInvois validation.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review source invoice" })).toHaveAttribute("href", "/invoices/invoice-1");
  });

  it("supports keyboard-native candidate selection and reports the selected count", () => {
    render(<EInvoiceWorkspace />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Selected").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Prepare selected" })).toBeEnabled();
  });
});
