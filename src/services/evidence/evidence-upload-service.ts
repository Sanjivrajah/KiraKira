import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const MEBIBYTE = 1024 * 1024;
const MAX_SIGNED_DOWNLOAD_SECONDS = 5 * 60;

const allowedFiles = {
  "image/jpeg": { extension: "jpg", maxBytes: 10 * MEBIBYTE },
  "image/png": { extension: "png", maxBytes: 10 * MEBIBYTE },
  "image/webp": { extension: "webp", maxBytes: 10 * MEBIBYTE },
  "application/pdf": { extension: "pdf", maxBytes: 25 * MEBIBYTE },
  "audio/mpeg": { extension: "mp3", maxBytes: 25 * MEBIBYTE },
  "audio/ogg": { extension: "ogg", maxBytes: 25 * MEBIBYTE },
  "audio/wav": { extension: "wav", maxBytes: 25 * MEBIBYTE },
  "text/csv": { extension: "csv", maxBytes: 10 * MEBIBYTE },
} as const;

type SupportedMimeType = keyof typeof allowedFiles;
type EvidenceEntityType = "transaction" | "invoice";

const uploadInputSchema = z.object({
  businessId: z.uuid(),
  entityId: z.uuid(),
  entityType: z.enum(["transaction", "invoice"]),
  sourceType: z.enum(["receipt", "voice", "pdf", "csv", "telegram_voice", "manual"]),
  mimeType: z.string(),
  originalFilename: z.string().max(500),
  bytes: z.instanceof(Uint8Array).refine((value) => value.byteLength > 0, "Evidence file is empty."),
});

export type EvidenceUploadInput = z.input<typeof uploadInputSchema>;

export class EvidenceUploadError extends Error {
  constructor(message: string, readonly code: "unauthorized" | "forbidden" | "invalid_file" | "upload_failed" | "not_found") {
    super(message);
  }
}

export interface ExtractionQueue {
  enqueue(input: { evidenceFileId: string; businessId: string }): Promise<void>;
}

export interface EvidenceUploadServiceDependencies {
  client: SupabaseClient<Database>;
  extractionQueue?: ExtractionQueue;
  createId?: () => string;
}

export function sanitizeEvidenceFilename(filename: string) {
  const baseName = filename.replace(/\\\\/g, "/").split("/").pop() ?? "evidence";
  const sanitized = baseName.replace(/[\u0000-\u001f<>:"|?*]/g, "-").replace(/\s+/g, " ").trim();
  return (sanitized || "evidence").slice(0, 160);
}

export function createEvidenceStoragePath(input: { businessId: string; entityType: EvidenceEntityType; entityId: string; fileId: string; mimeType: SupportedMimeType }) {
  return `${input.businessId}/${input.entityType}/${input.entityId}/${input.fileId}.${allowedFiles[input.mimeType].extension}`;
}

function getFileRules(mimeType: string, byteLength: number) {
  const rules = allowedFiles[mimeType as SupportedMimeType];
  if (!rules) throw new EvidenceUploadError("This evidence file type is not supported.", "invalid_file");
  if (byteLength > rules.maxBytes) throw new EvidenceUploadError("This evidence file exceeds the allowed size.", "invalid_file");
  return rules;
}

function bucketFor(entityType: EvidenceEntityType) {
  return entityType === "invoice" ? "invoice-documents" : "transaction-evidence";
}

export function createEvidenceUploadService({ client, extractionQueue, createId = randomUUID }: EvidenceUploadServiceDependencies) {
  async function requireWritableEntity(input: z.output<typeof uploadInputSchema>) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new EvidenceUploadError("Sign in before uploading evidence.", "unauthorized");

    const { data: membership } = await client
      .from("business_members")
      .select("role")
      .eq("business_id", input.businessId)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership || !["owner", "admin", "accountant", "staff"].includes(membership.role)) {
      throw new EvidenceUploadError("You do not have permission to upload evidence for this business.", "forbidden");
    }

    const entityQuery = input.entityType === "transaction"
      ? client.from("transactions").select("business_id").eq("id", input.entityId).maybeSingle()
      : client.from("invoices").select("business_id").eq("id", input.entityId).maybeSingle();
    const { data: entity } = await entityQuery;
    if (!entity || entity.business_id !== input.businessId) {
      throw new EvidenceUploadError("The evidence owner was not found in this business.", "not_found");
    }
  }

  async function markFailed(evidenceId: string, message: string) {
    await client.from("evidence_files").update({
      failure_reason: message,
      processing_status: "failed",
      storage_bucket: null,
      storage_path: null,
    }).eq("id", evidenceId);
  }

  return {
    async upload(rawInput: EvidenceUploadInput) {
      const input = uploadInputSchema.parse(rawInput);
      const rules = getFileRules(input.mimeType, input.bytes.byteLength);
      await requireWritableEntity(input);

      const evidenceId = createId();
      const path = createEvidenceStoragePath({
        businessId: input.businessId,
        entityType: input.entityType,
        entityId: input.entityId,
        fileId: evidenceId,
        mimeType: input.mimeType as SupportedMimeType,
      });
      const bucket = bucketFor(input.entityType);
      const checksum = createHash("sha256").update(input.bytes).digest("hex");
      const { error: metadataError } = await client.from("evidence_files").insert({
        id: evidenceId,
        business_id: input.businessId,
        source_type: input.sourceType,
        storage_bucket: bucket,
        storage_path: path,
        original_filename: sanitizeEvidenceFilename(input.originalFilename),
        mime_type: input.mimeType,
        checksum_sha256: checksum,
        size_bytes: input.bytes.byteLength,
        processing_status: "queued",
      });
      if (metadataError) throw new EvidenceUploadError("Evidence metadata could not be saved.", "upload_failed");

      const { error: storageError } = await client.storage.from(bucket).upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
      });
      if (storageError) {
        await client.storage.from(bucket).remove([path]);
        await markFailed(evidenceId, "The evidence file could not be stored.");
        throw new EvidenceUploadError("The evidence file could not be stored. Please try again.", "upload_failed");
      }

      try {
        await extractionQueue?.enqueue({ evidenceFileId: evidenceId, businessId: input.businessId });
      } catch {
        await client.from("evidence_files").update({
          failure_reason: "The evidence was stored but could not be queued for processing.",
          processing_status: "failed",
        }).eq("id", evidenceId);
        throw new EvidenceUploadError("The evidence was stored but could not be queued for processing.", "upload_failed");
      }

      return { evidenceId, bucket, path, checksum, extension: rules.extension };
    },

    async createSignedDownloadUrl(evidenceId: string, expiresInSeconds = MAX_SIGNED_DOWNLOAD_SECONDS) {
      if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > MAX_SIGNED_DOWNLOAD_SECONDS) {
        throw new EvidenceUploadError("Download links must expire within five minutes.", "invalid_file");
      }
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw new EvidenceUploadError("Sign in before downloading evidence.", "unauthorized");
      const { data: evidence } = await client.from("evidence_files")
        .select("storage_bucket, storage_path, deleted_at")
        .eq("id", evidenceId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!evidence?.storage_bucket || !evidence.storage_path) throw new EvidenceUploadError("Evidence is not available for download.", "not_found");
      const { data, error } = await client.storage.from(evidence.storage_bucket).createSignedUrl(evidence.storage_path, expiresInSeconds);
      if (error || !data?.signedUrl) throw new EvidenceUploadError("A private download link could not be created.", "upload_failed");
      return data.signedUrl;
    },

    async requestDeletion(evidenceId: string) {
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) throw new EvidenceUploadError("Sign in before requesting evidence deletion.", "unauthorized");
      const { data: evidence } = await client.from("evidence_files").select("business_id").eq("id", evidenceId).maybeSingle();
      if (!evidence) throw new EvidenceUploadError("Evidence was not found.", "not_found");
      const { data: membership } = await client.from("business_members").select("role")
        .eq("business_id", evidence.business_id).eq("user_id", userData.user.id).eq("status", "active").maybeSingle();
      if (!membership || !["owner", "admin"].includes(membership.role)) throw new EvidenceUploadError("You do not have permission to delete this evidence.", "forbidden");
      const { error } = await client.from("evidence_files").update({
        deletion_requested_at: new Date().toISOString(),
        deletion_requested_by: userData.user.id,
        processing_status: "delete_pending",
      }).eq("id", evidenceId);
      if (error) throw new EvidenceUploadError("Evidence deletion could not be scheduled.", "upload_failed");
    },
  };
}

export const evidenceFileLimits = allowedFiles;
export const evidenceSignedDownloadMaxSeconds = MAX_SIGNED_DOWNLOAD_SECONDS;
