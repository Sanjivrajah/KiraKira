import { messages, type BotLocale } from "@/bot/messages";

export function homeKeyboard(locale: BotLocale) {
  const labels = messages(locale).home;
  return {
    keyboard: [[{ text: labels.record }, { text: labels.recent }], [{ text: labels.summary }, { text: labels.help }]],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: locale === "ms" ? "Taip transaksi atau hantar nota suara" : "Type a transaction or send a voice note",
  };
}

export function getHomeAction(text: string): "record" | "recent" | "summary" | "help" | null {
  for (const locale of ["en", "ms"] as const) {
    const home = messages(locale).home;
    const match = (Object.entries(home) as ["record" | "recent" | "summary" | "help", string][]).find(([, label]) => label === text.trim());
    if (match) return match[0];
  }
  return null;
}
