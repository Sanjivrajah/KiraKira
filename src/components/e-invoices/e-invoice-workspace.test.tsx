import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EInvoiceWorkspace as Workspace } from "@/application/e-invoices";
import type { EInvoiceSubmissionWorkspace } from "@/hooks/use-e-invoices";
import { EInvoiceWorkspace } from "./e-invoice-workspace";

let mode: "demo" | "supabase" = "supabase";
let data: Workspace;
let submissionError = false;
let submissionData: EInvoiceSubmissionWorkspace;
let submitMutation = vi.fn();

vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ mode }) }));
vi.mock("@/hooks/use-business", () => ({ useBusiness: () => ({ data: { id: "business-1" }, isPending: false, isError: false }) }));
vi.mock("@/hooks/use-e-invoices", () => ({
  useEInvoiceWorkspace: () => ({ data, isPending: false, isError: false, refetch: vi.fn() }),
  usePrepareEInvoices: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSaveEInvoiceFields: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useApproveEInvoice: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCreateEInvoiceRevision: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useEInvoiceSubmissions: () => ({ data: submissionError ? undefined : submissionData, isPending: false, isError: submissionError, refetch: vi.fn() }),
  useSubmitEInvoices: () => ({ isPending: false, mutateAsync: submitMutation }),
  useGenerateEInvoiceSandboxPayload: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRefreshEInvoiceSubmission: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCancelEInvoiceDocument: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

beforeEach(() => {
  mode = "supabase";
  submissionError = false;
  submitMutation = vi.fn();
  submissionData = { environment: "sandbox", taxpayerIdentity: "C1234567890", productionReady: false, candidates: [], submissions: [] };
  data = {
    candidates: [{ id: "invoice-1", invoiceNumber: "INV-100", documentType: "invoice", issueDate: "2026-07-17", currency: "USD", paymentStatus: "sent", revision: 1, eligible: true, ineligibilityReasons: [], preparationId: "prep-1", preparationStatus: "needs_information" }],
    preparations: [{
      id: "prep-1", businessId: "business-1", sourceInvoiceId: "invoice-1", sourceInvoiceRevision: 1,
      documentType: "invoice", documentVersion: "1.0", scenario: "foreign_currency", hasCanonicalDocument: false,
      supplementalFields: {}, status: "needs_information", revision: 2,
      readinessResult: { ready: false, validatedAt: "2026-07-17T10:00:00.000Z", checkLabel: "NiagaAI internal preparation checks", diagnostics: [{ code: "missing", fieldPath: "document.exchangeRate", message: "Exchange rate is required.", severity: "error", group: "document", sourceReferenceLabel: "MyInvois Invoice v1.0" }] },
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
    expect(screen.getByRole("link", { name: "Enter exchange rate here" })).toHaveAttribute("href", "#preparation-field-exchangeRate");
    expect(screen.getByRole("spinbutton", { name: /Exchange rate to MYR/ })).toHaveAttribute("id", "preparation-field-exchangeRate");
  });

  it("routes reusable supplier blockers to the editable business profile", () => {
    data.preparations[0].readinessResult.diagnostics = [{ code: "missing", fieldPath: "business.compliance.msicCode", message: "Supplier MSIC code is missing.", severity: "error", group: "supplier", sourceReferenceLabel: "NiagaAI persisted source assembly" }];
    render(<EInvoiceWorkspace />);
    expect(screen.getByRole("link", { name: "Update business details" })).toHaveAttribute("href", "/settings#business-profile");
  });

  it("supports keyboard-native candidate selection and reports the selected count", () => {
    render(<EInvoiceWorkspace />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Selected").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Prepare selected" })).toBeEnabled();
  });

  it("keeps preparation records available when submission status fails independently", () => {
    submissionError = true;
    render(<EInvoiceWorkspace />);
    expect(screen.getByRole("alert")).toHaveTextContent("Submission controls are temporarily unavailable");
    expect(screen.getByRole("button", { name: "Retry submissions" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Saved invoice candidates" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /Exchange rate to MYR/ })).toBeInTheDocument();
  });

  it("keeps submission history discoverable after a refresh", () => {
    submissionData.submissions = [{
      id: "submission-1", businessId: "business-1", environment: "sandbox", idempotencyKey: "a".repeat(64), requestHash: "b".repeat(64),
      status: "failed", requestedAt: "2026-07-17T11:23:00.000Z", retryCount: 1, errorMessage: "Validation Error", documents: [{
        submissionId: "submission-1", eInvoiceDocumentId: "prep-1", payloadSnapshotId: "payload-1", invoiceCodeNumber: "INV-100", status: "failed",
        rejectionError: { message: "Validation Error", details: [{ message: "TimeExpected", propertyPath: "#/Invoice[0].IssueTime[0]" }] } as never,
      }],
    }];
    render(<EInvoiceWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Submission history 1" }));
    expect(screen.getByRole("heading", { name: "Rejected before MyInvois acknowledgement" })).toBeVisible();
    expect(screen.getByText(/IssueTime\[0\].*TimeExpected/)).toBeVisible();
  });

  it("does not show success when the server returns an existing failed attempt", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    submissionData.candidates = [{
      payloadSnapshotId: "payload-1", eInvoiceDocumentId: "prep-1", invoiceCodeNumber: "PAYLOAD-1",
      encodedSizeBytes: 100, documentVersion: "1.0", scenario: "b2b_invoice", productionEligible: true,
    }];
    submitMutation.mockResolvedValue({ result: {
      id: "submission-1", businessId: "business-1", environment: "sandbox", idempotencyKey: "a".repeat(64), requestHash: "b".repeat(64),
      status: "failed", requestedAt: "2026-07-17T11:23:00.000Z", retryCount: 1,
      errorMessage: "The prior submission failed before MyInvois acknowledgement.", documents: [],
    } });
    render(<EInvoiceWorkspace />);
    fireEvent.click(screen.getByRole("checkbox", { name: /PAYLOAD-1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit to sandbox" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("failed before MyInvois acknowledgement");
    expect(screen.queryByText(/Official validation is still processing/)).not.toBeInTheDocument();
  });
});
