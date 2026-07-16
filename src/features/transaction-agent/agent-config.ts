/** Limits for the local Telegram MVP. Keep these in one place so handlers and services agree. */
export const MAX_TEXT_MESSAGE_LENGTH = 4_000;
export const MAX_TRANSACTIONS_RETURNED = 10;
export const DUPLICATE_LOOKBACK_COUNT = 50;
export const CONVERSATION_STATE_EXPIRY_MS = 30 * 60 * 1000;
export const TELEGRAM_MESSAGE_LIMIT = 4_096;
export const UNDO_WINDOW_MS = 5 * 60 * 1000;
