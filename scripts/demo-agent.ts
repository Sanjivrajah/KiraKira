import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import { LocalReceivableRepository, ReceivableService } from "@/features/transaction-agent/receivables";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";

const marker = ".niagaai-agent-demo";
const owner = { telegramUserId: "demo-owner", telegramChatId: "demo-private-chat" };

function directoryFromArgs(): string {
  const index = process.argv.indexOf("--directory");
  const directory = resolve(index >= 0 ? (process.argv[index + 1] ?? "") : "./data/demo-agent");
  if (!basename(directory).toLowerCase().includes("demo")) throw new Error("For safety, --directory must name a demo-only directory.");
  return directory;
}

async function clearDemo(directory: string) {
  try { await readFile(join(directory, marker), "utf8"); }
  catch { throw new Error(`Refusing to clear ${directory}: it is not marked as NiagaAI demo data.`); }
  await Promise.all(["transaction-drafts.json", "transactions.json", "receivables.json", "receivable-payments.json", "conversation-states.json", "agent-orchestration.json", "user-preferences.json"].map((file) => rm(join(directory, file), { force: true })));
  console.log(`Cleared only marked demo data in ${directory}.`);
}

async function seedDemo(directory: string) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, marker), "Synthetic NiagaAI agent demo data only.\n", "utf8");
  const now = () => new Date("2026-07-17T09:00:00.000Z");
  const repositories = createLocalTransactionRepositories(directory);
  const drafts = new TransactionDraftService(repositories.drafts, repositories.transactions, now);
  const seed = [
    { type: "income" as const, amount: 120, description: "Catering deposit", party: "Kedai Murni", paymentMethod: "bank_transfer" as const, date: "2026-07-10" },
    { type: "expense" as const, amount: 38.5, description: "Ingredients", party: "Pasar Seri", paymentMethod: "cash" as const, date: "2026-07-11" },
    { type: "income" as const, amount: 65, description: "Nasi lemak sales", party: null, paymentMethod: "cash" as const, date: "2026-07-12" },
  ];
  for (const item of seed) {
    const draft = await drafts.createDraft({ extraction: { type: item.type, amount: item.amount, currency: "MYR", description: item.description, merchantOrCustomer: item.party, paymentMethod: item.paymentMethod, transactionDate: item.date, category: null, quantity: null, unit: null, missingFields: [], confidence: 1 }, ...owner, originalInput: `Synthetic demo: ${item.description}` });
    const result = await drafts.act({ action: "confirm", draftId: draft.id, telegramUserId: owner.telegramUserId });
    if (result.outcome !== "confirmed") throw new Error("Unable to create a confirmed synthetic demo transaction.");
  }
  const receivables = new ReceivableService(new LocalReceivableRepository(directory), now);
  await receivables.create({ ...owner, customerDisplayName: "Kedai Murni", amount: 450, issuedOn: "2026-07-01", dueOn: "2026-07-08", notes: "Synthetic overdue catering balance" });
  console.log(`Seeded synthetic local demo owner (${owner.telegramUserId}), 3 confirmed transactions, and 1 overdue receivable in ${directory}.`);
}

async function main() {
  const command = process.argv[2];
  const directory = directoryFromArgs();
  if (command === "seed") await seedDemo(directory);
  else if (command === "reset") await clearDemo(directory);
  else throw new Error("Usage: npm run demo:agent -- seed|reset [--directory ./data/demo-agent]");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unable to manage demo data.");
  process.exitCode = 1;
});
