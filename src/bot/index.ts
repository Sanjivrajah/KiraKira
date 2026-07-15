import { loadEnvConfig } from "@next/env";
import { createTelegramBot } from "@/bot/telegram-bot";
import { getBotEnvironment } from "@/lib/env";

loadEnvConfig(process.cwd());

const bot = createTelegramBot(getBotEnvironment());

bot.catch((error: unknown) => {
  console.error("Telegram bot update failed.", error);
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
  ]);

  await bot.start({
    onStart: () => console.info("NiagaAI Telegram bot is polling for updates."),
  });
}

startBot().catch((error: unknown) => {
  console.error("Telegram bot could not start. Check TELEGRAM_BOT_TOKEN and your network connection.", error);
  process.exitCode = 1;
});
