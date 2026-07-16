import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  createEvidenceStoragePath,
  createEvidenceUploadService,
  EvidenceUploadError,
  evidenceSignedDownloadMaxSeconds,
  sanitizeEvidenceFilename,
} from "./evidence-upload-service";

const businessId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const transactionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createClient({ storageError = false, entityBusinessId = businessId } = {}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const upload = vi.fn().mockResolvedValue({ error: storageError ? new Error("storage") : null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://private.example/signed" }, error: null });

  function query(table: string) {
    const response = table === "business_members"
      ? { data: { role: "staff" }, error: null }
      : table === "transactions" ? { data: { business_id: entityBusinessId }, error: null }
      : table === "evidence_files" ? { data: { storage_bucket: "transaction-evidence", storage_path: "path", deleted_at: null, business_id: businessId }, error: null }
      : { data: null, error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      maybeSingle: () => Promise.resolve(response),
      insert: (value: unknown) => { inserts.push(value); return Promise.resolve({ error: null }); },
      update: (value: unknown) => { updates.push(value); return chain; },
    };
    return chain;
  }

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "cccccccc-cccc-cccc-cccc-cccccccccccc" } }, error: null }) },
    from: vi.fn(query),
    storage: { from: vi.fn(() => ({ upload, remove, createSignedUrl })) },
  } as unknown as SupabaseClient<Database>;
  return { client, createSignedUrl, inserts, remove, updates, upload };
}

describe("evidence upload service", () => {
  it("generates a deterministic business-scoped path and sanitizes only display metadata", () => {
    expect(createEvidenceStoragePath({ businessId, entityType: "transaction", entityId: transactionId, fileId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", mimeType: "image/jpeg" }))
      .toBe(`${businessId}/transaction/${transactionId}/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg`);
    expect(sanitizeEvidenceFilename("../../receipt\u0000.pdf")).toBe("receipt-.pdf");
  });

  it("uploads allowed evidence only after membership and entity ownership resolve", async () => {
    const fake = createClient();
    const service = createEvidenceUploadService({ client: fake.client, createId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
    const result = await service.upload({
      businessId, entityId: transactionId, entityType: "transaction", sourceType: "receipt",
      mimeType: "image/png", originalFilename: "shop/receipt.png", bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result.path).toContain(`${businessId}/transaction/${transactionId}/`);
    expect(fake.upload).toHaveBeenCalledOnce();
    expect(fake.inserts).toEqual([expect.objectContaining({ business_id: businessId, original_filename: "receipt.png", processing_status: "queued" })]);
  });

  it("denies a cross-business owner before metadata or object creation", async () => {
    const fake = createClient({ entityBusinessId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    const service = createEvidenceUploadService({ client: fake.client });
    await expect(service.upload({ businessId, entityId: transactionId, entityType: "transaction", sourceType: "receipt", mimeType: "image/png", originalFilename: "receipt.png", bytes: new Uint8Array([1]) }))
      .rejects.toMatchObject({ code: "not_found" } satisfies Partial<EvidenceUploadError>);
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.inserts).toEqual([]);
  });

  it("rejects unsupported and oversized files before any object upload", async () => {
    const fake = createClient();
    const service = createEvidenceUploadService({ client: fake.client });
    await expect(service.upload({ businessId, entityId: transactionId, entityType: "transaction", sourceType: "receipt", mimeType: "application/x-msdownload", originalFilename: "bad.exe", bytes: new Uint8Array([1]) })).rejects.toMatchObject({ code: "invalid_file" });
    await expect(service.upload({ businessId, entityId: transactionId, entityType: "transaction", sourceType: "receipt", mimeType: "image/png", originalFilename: "large.png", bytes: new Uint8Array(10 * 1024 * 1024 + 1) })).rejects.toMatchObject({ code: "invalid_file" });
    expect(fake.upload).not.toHaveBeenCalled();
  });

  it("removes a failed object and leaves metadata in a clear failed state", async () => {
    const fake = createClient({ storageError: true });
    const service = createEvidenceUploadService({ client: fake.client });
    await expect(service.upload({ businessId, entityId: transactionId, entityType: "transaction", sourceType: "receipt", mimeType: "image/png", originalFilename: "receipt.png", bytes: new Uint8Array([1]) })).rejects.toMatchObject({ code: "upload_failed" });
    expect(fake.remove).toHaveBeenCalledOnce();
    expect(fake.updates).toContainEqual(expect.objectContaining({ processing_status: "failed", storage_bucket: null, storage_path: null }));
  });

  it("issues only short-lived signed downloads for metadata visible through RLS", async () => {
    const fake = createClient();
    const service = createEvidenceUploadService({ client: fake.client });
    await expect(service.createSignedDownloadUrl("dddddddd-dddd-4ddd-8ddd-dddddddddddd", evidenceSignedDownloadMaxSeconds + 1)).rejects.toMatchObject({ code: "invalid_file" });
    await expect(service.createSignedDownloadUrl("dddddddd-dddd-4ddd-8ddd-dddddddddddd", 60)).resolves.toBe("https://private.example/signed");
    expect(fake.createSignedUrl).toHaveBeenCalledWith("path", 60);
  });
});
