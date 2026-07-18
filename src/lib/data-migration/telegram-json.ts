import { z } from "zod";
import { confirmedTransactionSchema } from "@/features/transaction-agent/transaction-record.schema";

export const telegramLinkMappingSchema = z.object({
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  telegramAccountId: z.string().uuid(),
}).strict();
export const telegramLinkMappingsSchema = z.array(telegramLinkMappingSchema).min(1).max(10_000);

export type TelegramImportPreview = { index: number; transactionId: string | null; status: "ready" | "invalid"; error?: string };

/** Validation intentionally does not infer an owner from a Telegram ID. */
export function previewTelegramJson(input: unknown, links: unknown): { transactions: z.infer<typeof confirmedTransactionSchema>[]; mappings: z.infer<typeof telegramLinkMappingsSchema>; report: TelegramImportPreview[] } {
  const values = z.array(z.unknown()).max(10_000).parse(input);
  const mappings = telegramLinkMappingsSchema.parse(links);
  const byIdentity = new Map(mappings.map((mapping) => [`${mapping.telegramUserId}:${mapping.telegramChatId}`, mapping]));
  const transactions: z.infer<typeof confirmedTransactionSchema>[] = [];
  const report = values.map((value, index) => {
    const transactionId = value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null;
    const parsed = confirmedTransactionSchema.safeParse(value);
    if (!parsed.success) return { index, transactionId, status: "invalid" as const, error: "Record does not match the confirmed Telegram transaction schema." };
    if (!byIdentity.has(`${parsed.data.telegramUserId}:${parsed.data.telegramChatId}`)) return { index, transactionId: parsed.data.id, status: "invalid" as const, error: "No explicit Telegram account mapping was supplied for this user/chat." };
    transactions.push(parsed.data);
    return { index, transactionId: parsed.data.id, status: "ready" as const };
  });
  return { transactions, mappings, report };
}
