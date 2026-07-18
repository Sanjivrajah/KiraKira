/** Limits for the local Telegram MVP. Keep these in one place so handlers and services agree. */
export const MAX_TEXT_MESSAGE_LENGTH = 4_000;
export const MAX_TRANSACTIONS_RETURNED = 10;
export const DUPLICATE_LOOKBACK_COUNT = 50;
export const CONVERSATION_STATE_EXPIRY_MS = 30 * 60 * 1000;
export const TELEGRAM_MESSAGE_LIMIT = 4_096;
export const UNDO_WINDOW_MS = 5 * 60 * 1000;
export const MAX_AGENT_ACTIONS_PER_MESSAGE = 3;
export const MAX_AGENT_CLARIFICATION_TURNS = 6;
/** Below this extraction confidence the owner is nudged to double-check the draft before saving. */
export const LOW_CONFIDENCE_REVIEW_THRESHOLD = 0.5;
/** Recent owner replies retained on conversation state to give re-extraction cross-turn context. */
export const MAX_CONVERSATION_HISTORY_TURNS = 6;
export const MAX_PROVIDER_CALLS_PER_RUN = 2;
export const PROVIDER_TIMEOUT_MS = 20_000;
export const PROVIDER_RETRY_COUNT = 1;
/** Per Telegram user/chat window for calls that can consume external provider quota. */
export const PROVIDER_RATE_LIMIT_WINDOW_MS = 60_000;
export const PROVIDER_RATE_LIMIT_MAX_REQUESTS = 6;
