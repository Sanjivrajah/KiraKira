import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { previewTelegramJson } from "../src/lib/data-migration/telegram-json";
import type { Database, Json } from "../src/lib/supabase/database.types";

type Args = { input: string; links: string; dryRun: boolean; batchId: string };
function readArgs(values: string[]): Args {
  const get = (name: string) => { const index = values.indexOf(name); return index === -1 ? undefined : values[index + 1]; };
  const input = get("--input"); const links = get("--links"); const batchId = get("--batch-id") ?? randomUUID();
  if (!input || !links || !values.includes("--dry-run") && !values.includes("--commit")) throw new Error("Usage: tsx scripts/import-telegram-json.ts --input data/transactions.json --links links.json --dry-run|--commit [--batch-id UUID]");
  if (values.includes("--dry-run") && values.includes("--commit")) throw new Error("Choose exactly one of --dry-run or --commit.");
  return { input: resolve(input), links: resolve(links), dryRun: values.includes("--dry-run"), batchId };
}
function minor(value: number | null) { if (value === null || !Number.isFinite(value) || value < 0) throw new Error("Confirmed record has an invalid amount."); return Math.round(value * 100); }

async function main() {
  const args = readArgs(process.argv.slice(2));
  const raw = JSON.parse(await readFile(args.input, "utf8")) as unknown;
  const links = JSON.parse(await readFile(args.links, "utf8")) as unknown;
  const preview = previewTelegramJson(raw, links);
  const ready = preview.report.filter((entry) => entry.status === "ready");
  const report = { batchId: args.batchId, source: "telegram_json", total: preview.report.length, ready: ready.length, errors: preview.report.filter((entry) => entry.status === "invalid") };
  if (args.dryRun) { console.log(JSON.stringify({ mode: "dry-run", report }, null, 2)); return; }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(); const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("--commit requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  await copyFile(args.input, `${args.input}.backup-${new Date().toISOString().replaceAll(":", "-")}`);
  const client = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const mappingByIdentity = new Map<string, string>(preview.mappings.map((mapping) => [`${mapping.telegramUserId}:${mapping.telegramChatId}`, mapping.telegramAccountId]));
  let imported = 0; const runtimeErrors: Array<{ transactionId: string; error: string }> = [];
  for (const transaction of preview.transactions) {
    const accountId = mappingByIdentity.get(`${transaction.telegramUserId}:${transaction.telegramChatId}`);
    if (!accountId) { runtimeErrors.push({ transactionId: transaction.id, error: "No explicit mapping was supplied." }); continue; }
    if (!transaction.transactionDate || !transaction.description || !transaction.category) { runtimeErrors.push({ transactionId: transaction.id, error: "Confirmed record is missing its date, description, or category." }); continue; }
    const { data: account, error: accountError } = await client.from("telegram_accounts").select("id,business_id,user_id,linked_at,unlinked_at").eq("id", accountId).maybeSingle();
    if (accountError || !account?.linked_at || account.unlinked_at || !account.business_id || !account.user_id) { runtimeErrors.push({ transactionId: transaction.id, error: "Mapped Telegram account is not actively linked." }); continue; }
    const { data: membership } = await client.from("business_members").select("business_id").eq("business_id", account.business_id).eq("user_id", account.user_id).eq("status", "active").in("role", ["owner", "admin", "accountant", "staff"]).maybeSingle();
    if (!membership) { runtimeErrors.push({ transactionId: transaction.id, error: "Mapped account no longer has active business membership." }); continue; }
    const externalKey = `telegram-json-import:${args.batchId}:${transaction.id}`;
    const { data: existing } = await client.from("transactions").select("id").eq("business_id", account.business_id).eq("external_key", externalKey).maybeSingle();
    if (existing) continue;
    try {
      const amount = minor(transaction.amount);
      const lifecycle = transaction.status === "voided" ? "voided" : "confirmed";
      const row: Database["public"]["Tables"]["transactions"]["Insert"] = {
        business_id: account.business_id, direction: transaction.type === "expense" ? "expense" : "income", transaction_type: transaction.type === "expense" ? "expense" : transaction.type === "customer_payment" ? "customer_payment" : "income", lifecycle,
        occurred_at: transaction.confirmedAt, transaction_date: transaction.transactionDate, accounting_date: transaction.transactionDate, description: transaction.description, category_code: transaction.category, currency: "MYR", subtotal_minor: amount, total_minor: amount,
        payment_status: "not_applicable", payment_method_code: transaction.paymentMethod === "unknown" ? null : transaction.paymentMethod, e_invoice_treatment: "undetermined", source_provenance: transaction.sourceType === "telegram_voice" ? "telegram_voice" : "telegram_text", external_key: externalKey,
        confirmed_at: transaction.confirmedAt, confirmed_by: account.user_id, voided_at: lifecycle === "voided" ? transaction.voidedAt ?? transaction.updatedAt : null, voided_by: lifecycle === "voided" ? account.user_id : null, void_reason: lifecycle === "voided" ? transaction.voidReason ?? "Imported voided Telegram record" : null,
        confirmation: { ...transaction, import: { source: "telegram_json", batchId: args.batchId, originalTransactionId: transaction.id, originalSourceType: transaction.sourceType } } as Json, source_links: [], lines: [], totals: {}, created_at: transaction.createdAt, updated_at: transaction.updatedAt, created_by: account.user_id, updated_by: account.user_id,
      };
      const { error } = await client.from("transactions").insert([row]);
      if (error) throw error; imported += 1;
    } catch (error) { runtimeErrors.push({ transactionId: transaction.id, error: error instanceof Error ? error.message : "Database insert failed." }); }
  }
  console.log(JSON.stringify({ mode: "commit", report: { ...report, imported, skippedDuplicates: ready.length - imported - runtimeErrors.length, runtimeErrors } }, null, 2));
  if (runtimeErrors.length) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
