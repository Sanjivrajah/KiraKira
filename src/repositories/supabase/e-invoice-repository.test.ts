import { describe, expect, it, vi } from "vitest";
import { SupabaseEInvoiceRepository } from "./e-invoice-repository";

const businessId = "11111111-1111-4111-8111-111111111111";

const connectionRow = {
  id: "22222222-2222-4222-8222-222222222222",
  business_id: businessId,
  environment: "sandbox",
  auth_mode: "taxpayer",
  taxpayer_tin: "C25845632020",
  taxpayer_registration_scheme: null,
  taxpayer_registration_value: null,
  onbehalfof_value: "C25845632020",
  credential_set_id: "sandbox-primary",
  client_id_secret_ref: "env:sandbox:MYINVOIS_SANDBOX_CLIENT_ID",
  client_secret_secret_ref: "env:sandbox:MYINVOIS_SANDBOX_CLIENT_SECRET",
  enabled: true,
  document_version: "1.0",
  verified_at: null,
  verified_by: null,
  sandbox_verified_at: null,
  sandbox_verified_by: null,
  production_activated_at: null,
  production_activated_by: null,
  production_disabled_at: null,
  production_disabled_by: null,
  production_activation_reason: null,
  created_at: "2026-07-18T00:00:00.000Z",
  updated_at: "2026-07-18T00:00:00.000Z",
};

describe("SupabaseEInvoiceRepository.upsertConnection", () => {
  it("updates only mutable connection fields when the tenant-scoped connection already exists", async () => {
    const existingQuery = {
      select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
    };
    existingQuery.select.mockReturnValue(existingQuery);
    existingQuery.eq.mockReturnValue(existingQuery);
    existingQuery.maybeSingle.mockResolvedValue({ data: connectionRow, error: null });

    const updateQuery = {
      update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    updateQuery.single.mockResolvedValue({ data: connectionRow, error: null });

    const from = vi.fn().mockReturnValueOnce(existingQuery).mockReturnValueOnce(updateQuery);
    const repository = new SupabaseEInvoiceRepository({ from } as never);

    await repository.upsertConnection({
      businessId, environment: "sandbox", authMode: "taxpayer", taxpayerTin: "C25845632020",
      credentialSetId: "sandbox-primary", clientIdSecretRef: "env:sandbox:MYINVOIS_SANDBOX_CLIENT_ID",
      clientSecretSecretRef: "env:sandbox:MYINVOIS_SANDBOX_CLIENT_SECRET", enabled: true,
    });

    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ taxpayer_tin: "C25845632020" }));
    expect(updateQuery.update.mock.calls[0][0]).not.toHaveProperty("business_id");
    expect(updateQuery.update.mock.calls[0][0]).not.toHaveProperty("environment");
  });
});
