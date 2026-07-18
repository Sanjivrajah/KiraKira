import { messages, type BotLocale } from "@/bot/messages";
import type { TelegramUserPreference } from "@/bot/user-preferences";
import type { ConversationRequestedField } from "@/features/transaction-agent/conversation-state";

const idButton = (text: string, action: string, id: string) => ({ text, callback_data: `tx:${action}:${id}` });

export function reviewKeyboard(id: string, locale: BotLocale, hasTranscript = false) {
  const m = messages(locale);
  return { inline_keyboard: [
    [idButton(m.confirm, "confirm", id), idButton(m.correct, "correct", id)],
    ...(hasTranscript ? [[idButton(locale === "ms" ? "Lihat transkrip" : "View transcript", "transcript", id)]] : []),
    [idButton(m.cancel, "cancel", id)],
  ] };
}

export function clarificationKeyboard(field: ConversationRequestedField, id: string, locale: BotLocale) {
  const rows: { text: string; callback_data: string }[][] = [];
  if (field === "paymentMethod") rows.push([
    ["Cash", "cash"], ["Bank transfer", "bank_transfer"], ["Card", "card"], ["E-wallet", "ewallet"], ["Credit", "credit"],
  ].map(([text, value]) => idButton(text, `answer.${value}`, id)));
  if (field === "type") rows.push([
    [locale === "ms" ? "Wang masuk" : "Money in", "income"], [locale === "ms" ? "Wang keluar" : "Money out", "expense"], [locale === "ms" ? "Bayaran pelanggan" : "Customer payment", "customer_payment"],
  ].map(([text, value]) => idButton(text, `answer.${value}`, id)));
  if (field === "transactionDate") rows.push([
    [locale === "ms" ? "Hari ini" : "Today", "today"], [locale === "ms" ? "Semalam" : "Yesterday", "yesterday"], [locale === "ms" ? "Tarikh lain" : "Choose another date", "other_date"],
  ].map(([text, value]) => idButton(text, `answer.${value}`, id)));
  rows.push([idButton(messages(locale).cancel, "cancel", id)]);
  return { inline_keyboard: rows };
}

export function correctionKeyboard(id: string, locale: BotLocale) {
  const labels = locale === "ms"
    ? [["Amaun", "amount"], ["Keterangan", "purpose"], ["Peniaga/pelanggan", "merchantOrCustomer"], ["Tarikh", "transactionDate"], ["Cara bayaran", "paymentMethod"], ["Pembetulan lain", "other"]]
    : [["Amount", "amount"], ["Description", "purpose"], ["Merchant/customer", "merchantOrCustomer"], ["Date", "transactionDate"], ["Payment method", "paymentMethod"], ["Other correction", "other"]];
  return { inline_keyboard: [...labels.map(([text, field]) => [idButton(text, `field.${field}`, id)]), [idButton(messages(locale).cancel, "cancel", id)]] };
}

export function replacementKeyboard(id: string, locale: BotLocale) {
  const labels = locale === "ms" ? ["Terus semak draf semasa", "Buang dan mula transaksi baharu", "Batal permintaan baharu"] : ["Continue current draft", "Discard it and start new", "Cancel new request"];
  return { inline_keyboard: [[idButton(labels[0], "keep", id)], [idButton(labels[1], "replace", id)], [idButton(labels[2], "drop_new", id)]] };
}

export function undoKeyboard(id: string, locale: BotLocale) { return { inline_keyboard: [[idButton(locale === "ms" ? "Batalkan simpanan terakhir" : "Undo last save", "undo", id)]] }; }
export function settingsKeyboard(preference?: TelegramUserPreference, locale: BotLocale = preference?.locale ?? "en") {
  const ms = locale === "ms";
  const timezone = preference?.timezone ?? "Asia/Kuala_Lumpur";
  const paymentMethod = preference?.defaultPaymentMethod ?? "none";
  const paymentLabel = {
    none: ms ? "Tiada" : "None",
    cash: ms ? "Tunai" : "Cash",
    bank_transfer: ms ? "Pindahan bank" : "Bank transfer",
    card: ms ? "Kad" : "Card",
    ewallet: "E-wallet",
    credit: ms ? "Kredit" : "Credit",
  }[paymentMethod];
  return { inline_keyboard: [
    [{ text: `${locale === "en" ? "✓ " : ""}English`, callback_data: "locale:en" }, { text: `${locale === "ms" ? "✓ " : ""}Bahasa Melayu`, callback_data: "locale:ms" }],
    [{ text: `${ms ? "Zon waktu" : "Timezone"}: ${timezone === "Asia/Kuala_Lumpur" ? "Malaysia" : "UTC"}`, callback_data: "settings:menu:timezone" }],
    [{ text: `${ms ? "Cara bayaran lalai" : "Default payment"}: ${paymentLabel}`, callback_data: "settings:menu:payment" }],
  ] };
}

export function timezoneSettingsKeyboard(locale: BotLocale) {
  return { inline_keyboard: [
    [{ text: "Malaysia (Asia/Kuala_Lumpur)", callback_data: "settings:timezone:malaysia" }],
    [{ text: "UTC", callback_data: "settings:timezone:utc" }],
    [{ text: locale === "ms" ? "Kembali" : "Back", callback_data: "settings:menu:main" }],
  ] };
}

export function paymentSettingsKeyboard(locale: BotLocale) {
  const labels = locale === "ms"
    ? [["Tiada", "none"], ["Tunai", "cash"], ["Pindahan bank", "bank_transfer"], ["Kad", "card"], ["E-wallet", "ewallet"], ["Kredit", "credit"]]
    : [["None", "none"], ["Cash", "cash"], ["Bank transfer", "bank_transfer"], ["Card", "card"], ["E-wallet", "ewallet"], ["Credit", "credit"]];
  return { inline_keyboard: [
    ...labels.map(([text, value]) => [{ text, callback_data: `settings:payment:${value}` }]),
    [{ text: locale === "ms" ? "Kembali" : "Back", callback_data: "settings:menu:main" }],
  ] };
}
export function duplicateKeyboard(id: string, locale: BotLocale) { return { inline_keyboard: [[idButton(locale === "ms" ? "Simpan juga" : "Save anyway", "save_anyway", id)], [idButton(messages(locale).cancel, "cancel", id)]] }; }
