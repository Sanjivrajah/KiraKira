import { loadEnvConfig } from "@next/env";
import { createTelegramBot } from "@/bot/telegram-bot";
import { getBotEnvironment } from "@/lib/env";

loadEnvConfig(process.cwd());

const bot = createTelegramBot(getBotEnvironment());

bot.catch((error: unknown) => {
  console.error("Telegram bot update failed.", error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error");
});

let isStopping = false;

function stopBot(signal: NodeJS.Signals) {
  if (isStopping) return;
  isStopping = true;
  console.info(`Stopping Telegram bot after ${signal}.`);
  bot.stop();
}

process.once("SIGINT", () => stopBot("SIGINT"));
process.once("SIGTERM", () => stopBot("SIGTERM"));

async function startBot() {
  await bot.api.setMyCommands([
    { command: "start", description: "Learn what NiagaAI can do" },
    { command: "help", description: "See examples and bot help" },
    { command: "transactions", description: "View your recent confirmed transactions" },
    { command: "summary", description: "View your basic transaction summary" },
    { command: "search", description: "Search your confirmed transactions" },
    { command: "export", description: "Export a local CSV for a date range" },
    { command: "settings", description: "Set language, timezone, and payment defaults" },
    { command: "cancel", description: "Cancel an active correction or clarification" },
  ]);

  await bot.start({
    onStart: () => console.info("NiagaAI Telegram bot is polling for updates."),
  });
}

startBot().catch((error: unknown) => {
  console.error("Telegram bot could not start. Check TELEGRAM_BOT_TOKEN and your network connection.", error);
  process.exitCode = 1;
});
