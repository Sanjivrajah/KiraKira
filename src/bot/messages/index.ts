import type { ConversationRequestedField } from "@/features/transaction-agent/conversation-state";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";
import { MAX_TEXT_MESSAGE_LENGTH } from "@/features/transaction-agent/agent-config";
import type { TelegramUserPreference } from "@/bot/user-preferences";

export type BotLocale = "en" | "ms";

const copy = {
  en: {
    home: { record: "Record transaction", recent: "Recent transactions", summary: "Summary", help: "Help" },
    start: "Welcome to NiagaAI. Record money in or money out using text or a voice note.\n\nExample: Semalam beli ayam RM85 cash dekat Pasar Borong\n\nChoose Record transaction to begin.",
    help: "Send a transaction as text, a voice note, or one clear receipt image (JPG, PNG, or WEBP up to 10 MiB). I’ll ask for missing details, then show a draft before anything is saved. PDFs and multi-receipt images are not supported yet.\n\nExamples:\n• Sold 10 nasi lemak RM5 each cash today\n• Customer Ravi transferred RM450 for catering semalam\n\nCommands: /transactions, /summary [start end], /insights profit, /search query, /export start end, /settings, /cancel\n\nThis local demo stores data only on the machine running the bot.",
    record: "Send the transaction as text, a voice note, or one clear receipt image. Include the amount, what it was for, date, and payment method if you can.",
    settings: "Choose your NiagaAI interface language. Your transaction wording will stay unchanged.",
    localeSaved: "Interface language changed to English.",
    preparing: "Preparing the transaction…",
    listening: "Listening to your voice note…",
    cancel: "Cancel transaction",
    confirm: "Confirm",
    correct: "Correct something",
    saved: (type: TransactionExtraction["type"]) => type === "expense" ? "Expense recorded" : type === "customer_payment" ? "Customer payment recorded" : "Money in recorded",
  },
  ms: {
    home: { record: "Catat transaksi", recent: "Transaksi terkini", summary: "Ringkasan", help: "Bantuan" },
    start: "Selamat datang ke NiagaAI. Catat wang masuk atau wang keluar melalui teks atau nota suara.\n\nContoh: Semalam beli ayam RM85 cash dekat Pasar Borong\n\nPilih Catat transaksi untuk mula.",
    help: "Hantar transaksi melalui teks, nota suara atau satu imej resit yang jelas (JPG, PNG atau WEBP sehingga 10 MiB). Saya akan tanya maklumat yang belum lengkap dan tunjukkan draf sebelum menyimpan. PDF dan imej berbilang resit belum disokong.\n\nContoh:\n• Jual 10 nasi lemak RM5 satu tunai hari ini\n• Pelanggan Ravi transfer RM450 untuk katering semalam\n\nArahan: /transactions, /summary [mula akhir], /insights untung, /search carian, /export mula akhir, /settings, /cancel\n\nDemo setempat ini menyimpan data pada komputer yang menjalankan bot sahaja.",
    record: "Hantar transaksi melalui teks, nota suara atau satu imej resit yang jelas. Sertakan amaun, tujuan, tarikh dan cara bayaran jika boleh.",
    settings: "Pilih bahasa paparan NiagaAI. Ayat asal transaksi anda tidak akan diubah.",
    localeSaved: "Bahasa paparan ditukar kepada Bahasa Melayu.",
    preparing: "Sedang menyediakan transaksi…",
    listening: "Sedang mendengar nota suara…",
    cancel: "Batal transaksi",
    confirm: "Sahkan",
    correct: "Betulkan sesuatu",
    saved: (type: TransactionExtraction["type"]) => type === "expense" ? "Perbelanjaan direkodkan" : type === "customer_payment" ? "Bayaran pelanggan direkodkan" : "Wang masuk direkodkan",
  },
} as const;

export function messages(locale: BotLocale) { return copy[locale]; }

export function helpMessage(locale: BotLocale, persistenceMode: "local" | "supabase") {
  if (persistenceMode === "local") return copy[locale].help;
  const localDisclosure = locale === "ms"
    ? "Demo setempat ini menyimpan data pada komputer yang menjalankan bot sahaja."
    : "This local demo stores data only on the machine running the bot.";
  const liveDisclosure = locale === "ms"
    ? "Rekod yang disahkan disimpan dalam ruang kerja pangkalan data yang dipautkan."
    : "Confirmed records are saved to the linked database workspace.";
  return copy[locale].help.replace(localDisclosure, liveDisclosure);
}

const paymentMethodLabels: Record<NonNullable<TelegramUserPreference["defaultPaymentMethod"]>, [string, string]> = {
  cash: ["Cash", "Tunai"],
  bank_transfer: ["Bank transfer", "Pindahan bank"],
  card: ["Card", "Kad"],
  ewallet: ["E-wallet", "E-wallet"],
  credit: ["Credit", "Kredit"],
};

export function settingsMessage(locale: BotLocale, preference: TelegramUserPreference): string {
  const ms = locale === "ms";
  const paymentMethod = preference.defaultPaymentMethod
    ? paymentMethodLabels[preference.defaultPaymentMethod][ms ? 1 : 0]
    : (ms ? "Tiada" : "None");
  return ms
    ? `Tetapan NiagaAI\n\nBahasa: Bahasa Melayu\nZon waktu: ${preference.timezone}\nCara bayaran lalai: ${paymentMethod}\n\nCara bayaran lalai akan dipraisi dalam draf baharu apabila mesej anda tidak menyatakannya. Anda masih boleh menyemaknya sebelum simpan.`
    : `NiagaAI settings\n\nLanguage: English\nTimezone: ${preference.timezone}\nDefault payment method: ${paymentMethod}\n\nThe default payment method prefills new drafts only when your message does not specify one. You can still review and change it before saving.`;
}

export function interfaceText(locale: BotLocale) {
  const ms = locale === "ms";
  return {
    loadTransactionsFailed: ms ? "Saya tidak dapat memuatkan transaksi anda sekarang. Cuba lagi sebentar lagi." : "I couldn't load your transactions right now. Please try again shortly.",
    loadSummaryFailed: ms ? "Saya tidak dapat mengira ringkasan anda sekarang. Cuba lagi sebentar lagi." : "I couldn't calculate your summary right now. Please try again shortly.",
    replacementPrompt: ms ? "Anda masih mempunyai draf yang belum selesai. Apa yang anda mahu lakukan?" : "You still have an unfinished draft. What would you like to do?",
    unavailable: ms ? "Transaksi itu tidak lagi tersedia. Sila hantar semula." : "That transaction is no longer available. Please send it again.",
    restarted: ms ? "Aliran sebelumnya telah tamat. Saya mulakan transaksi baharu." : "The previous flow expired. I started a new transaction.",
    workflowExpired: ms ? "Tugas ini telah tamat dan tiada tindakan dibuat. Hantar transaksi sekali lagi untuk mula semula." : "This task expired and no action was taken. Send the transaction again to start over.",
    tooLong: ms ? `Transaksi terlalu panjang. Hadnya ${MAX_TEXT_MESSAGE_LENGTH.toLocaleString("ms-MY")} aksara.` : `That transaction is too long. Please keep it under ${MAX_TEXT_MESSAGE_LENGTH.toLocaleString("en-MY")} characters.`,
    prepareFailed: ms ? "Saya tidak dapat menyediakan draf sekarang. Cuba lagi sebentar lagi. Tiada apa-apa disimpan." : "I couldn't prepare that draft right now. Please try again. Nothing was saved.",
    linkRequired: ms ? "Pautkan chat Telegram ini dahulu dalam Tetapan NiagaAI, kemudian hantar kod dengan /link <kod>." : "Link this Telegram chat in NiagaAI Settings first, then send the code with /link <code>.",
    voiceTooLarge: (mib: number) => ms ? `Nota suara itu terlalu besar. Pastikan saiznya kurang daripada ${mib} MiB atau hantar teks.` : `That voice note is too large. Please keep it under ${mib} MiB or send text.`,
    voiceFailed: ms ? "Saya tidak dapat memproses nota suara itu. Cuba lagi atau hantar teks." : "I couldn't process that voice note. Please try again or send text.",
    receiptPreparing: ms ? "Sedang membaca resit…" : "Reading the receipt…",
    receiptTooLarge: ms ? "Imej resit itu terlalu besar. Hantar satu imej JPG, PNG atau WEBP di bawah 10 MiB." : "That receipt image is too large. Send one JPG, PNG, or WEBP image under 10 MiB.",
    receiptUnsupported: ms ? "Format itu belum disokong. Hantar satu imej resit JPG, PNG atau WEBP; PDF dan imej berbilang resit belum disokong." : "That format isn't supported yet. Send one JPG, PNG, or WEBP receipt image; PDFs and multi-receipt images are not supported.",
    receiptUnreadable: ms ? "Saya tidak dapat membaca butiran transaksi daripada imej itu. Cuba semula dengan satu resit yang terang dan jelas, atau hantar butiran melalui teks." : "I couldn't read transaction details from that image. Try again with one well-lit, clear receipt, or send the details as text.",
    receiptCurrency: ms ? "Saya hanya boleh menyediakan draf resit MYR sekarang. Hantar butiran transaksi melalui teks untuk mata wang lain." : "I can only prepare MYR receipt drafts right now. Send the transaction details as text for another currency.",
    receiptFailed: ms ? "Saya tidak dapat memproses resit itu sekarang. Cuba lagi atau hantar butiran melalui teks. Tiada apa-apa disimpan." : "I couldn't process that receipt right now. Please try again or send the details as text. Nothing was saved.",
    receiptWhileActive: ms ? "Anda sudah mempunyai draf aktif. Sahkan atau batalkannya sebelum menghantar resit lain." : "You already have an active draft. Confirm or cancel it before sending another receipt.",
    unsupported: ms ? "NiagaAI menyokong teks transaksi, nota suara dan satu imej resit JPG, PNG atau WEBP." : "NiagaAI supports transaction text, voice notes, and one JPG, PNG, or WEBP receipt image.",
    noActive: ms ? "Tiada transaksi aktif untuk dibatalkan." : "There is no active transaction to cancel.",
    cancelled: ms ? "Transaksi dibatalkan. Tiada apa-apa disimpan." : "Transaction cancelled. Nothing was saved.",
    cancelFailed: ms ? "Saya tidak dapat membatalkan transaksi itu sekarang. Cuba lagi." : "I couldn't cancel that transaction right now. Please try again.",
    staleAction: ms ? "Tindakan ini tidak lagi tersedia." : "This action is no longer available.",
    missingDraft: ms ? "Draf ini tidak lagi tersedia." : "This draft is no longer available.",
    foreignAction: ms ? "Tindakan ini milik pengguna lain." : "This action belongs to another user.",
    transcriptTitle: ms ? "Transkrip nota suara" : "Voice note transcript",
    noTranscript: ms ? "Tiada transkrip." : "No transcript available.",
    undoVoided: ms ? "Simpanan terakhir dibatalkan. Rekod audit dikekalkan sebagai dibatalkan." : "Last save undone. The audit record is retained as voided.",
    undoExpired: ms ? "Tempoh batal simpan telah tamat." : "The undo window has ended.",
    undoRepeated: ms ? "Simpanan ini telah dibatalkan." : "This save was already undone.",
    undoUnavailable: ms ? "Simpanan ini tidak boleh dibatalkan." : "This save cannot be undone.",
    newRequestExpired: ms ? "Permintaan baharu telah tamat." : "The new request is no longer available.",
    replacementFailed: ms ? "Draf lama dibuang, tetapi transaksi baharu tidak dapat diproses. Sila hantar semula." : "The old draft was discarded, but the new transaction could not be processed. Please send it again.",
    freeCorrection: ms ? "Terangkan pembetulan dengan ayat biasa." : "Describe the correction in your own words.",
    correctionPrompt: ms ? "Apa yang mahu dibetulkan?" : "What would you like to correct?",
    datePrompt: ms ? "Taip tarikh, contohnya 14 Julai 2026." : "Type the date, for example 14 July 2026.",
    quickAnswerFailed: ms ? "Jawapan itu tidak dapat diproses. Cuba taip jawapan anda." : "I couldn't apply that answer. Please type your answer instead.",
    duplicateIntro: ms ? "Ini kelihatan serupa dengan transaksi yang telah direkodkan:" : "This looks similar to a transaction already recorded:",
    expiredDraft: ms ? "Draf ini telah tamat atau sudah diproses." : "This draft expired or was already handled.",
    foreignDraft: ms ? "Draf ini milik pengguna lain." : "This draft belongs to another user.",
    incomplete: ms ? "Transaksi ini belum lengkap." : "This transaction is not ready to save.",
    actionFailed: ms ? "Tindakan itu gagal. Keadaan transaksi anda dikekalkan." : "I couldn't complete that action. Your transaction state is preserved.",
    batchIntro: (total: number) => ms
      ? `Saya kesan ${total} transaksi dalam mesej itu. Mari semak satu demi satu.`
      : `I caught ${total} transactions in that message. Let's review them one at a time.`,
    batchNext: (index: number, total: number) => ms
      ? `Seterusnya — transaksi ${index} daripada ${total}.`
      : `Next — transaction ${index} of ${total}.`,
    lowConfidenceHint: ms
      ? "Saya kurang pasti dengan yang ini — sila semak butirannya sebelum sahkan."
      : "I'm not fully sure about this one — please double-check the details before saving.",
  };
}

export function clarificationMessage(locale: BotLocale, draft: TransactionExtraction, field: ConversationRequestedField, remaining: number): string {
  const understood: string[] = [];
  if (draft.amount) understood.push(new Intl.NumberFormat(locale === "ms" ? "ms-MY" : "en-MY", { style: "currency", currency: "MYR" }).format(draft.amount));
  if (draft.description) understood.push(draft.description);
  if (draft.merchantOrCustomer) understood.push(draft.merchantOrCustomer);
  const questions: Record<ConversationRequestedField, [string, string]> = {
    amount: ["What was the amount?", "Berapakah amaunnya?"],
    type: ["Was this money in, money out, or a customer payment?", "Adakah ini wang masuk, wang keluar atau bayaran pelanggan?"],
    purpose: ["What was this payment for?", "Bayaran ini untuk apa?"],
    transactionDate: ["When did this happen?", "Bilakah transaksi ini berlaku?"],
    paymentMethod: ["How was it paid?", "Bagaimanakah bayaran dibuat?"],
    merchantOrCustomer: ["Who was the customer or supplier?", "Siapakah pelanggan atau pembekal?"],
  };
  const known = understood.length ? (locale === "ms" ? `Saya faham: ${understood.join(" · ")}.\n` : `I understood: ${understood.join(" · ")}.\n`) : "";
  const progress = remaining > 1 ? (locale === "ms" ? `${remaining} butiran lagi. ` : `${remaining} details to go. `) : "";
  return `${known}${progress}${questions[field][locale === "ms" ? 1 : 0]}`;
}

export function formatDraft(draft: Omit<TransactionExtraction, "missingFields"> & { missingFields?: TransactionExtraction["missingFields"] }, locale: BotLocale): string {
  const amount = draft.amount === null ? (locale === "ms" ? "Belum diketahui" : "Not known yet") : new Intl.NumberFormat(locale === "ms" ? "ms-MY" : "en-MY", { style: "currency", currency: "MYR" }).format(draft.amount);
  const type = locale === "ms"
    ? ({ income: "Wang masuk", expense: "Wang keluar", customer_payment: "Bayaran pelanggan", unknown: "Jenis belum diketahui" } as const)[draft.type]
    : ({ income: "Money in", expense: "Money out", customer_payment: "Customer payment", unknown: "Type not known yet" } as const)[draft.type];
  const method = ({ cash: locale === "ms" ? "Tunai" : "Cash", bank_transfer: locale === "ms" ? "Pindahan bank" : "Bank transfer", card: locale === "ms" ? "Kad" : "Card", ewallet: "E-wallet", credit: locale === "ms" ? "Kredit" : "Credit", unknown: locale === "ms" ? "Belum diketahui" : "Not known yet" } as const)[draft.paymentMethod];
  const lines = [type, amount, draft.description || (locale === "ms" ? "Tiada keterangan" : "No description")];
  if (draft.merchantOrCustomer) lines.push(draft.merchantOrCustomer);
  lines.push(`${draft.transactionDate ?? (locale === "ms" ? "Tarikh belum diketahui" : "Date not known yet")} · ${method}`);
  if (draft.category) lines.push(draft.category);
  if (draft.confidence < 0.7) lines.push(locale === "ms" ? "Sila semak butiran ini dengan teliti." : "Please check these details carefully.");
  return lines.join("\n");
}
