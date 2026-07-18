import { createHash, randomBytes } from "node:crypto";

export const TELEGRAM_LINK_CODE_TTL_MS = 10 * 60 * 1000;
const LINK_CODE_BYTES = 24;

export function createTelegramLinkCode() {
  const code = randomBytes(LINK_CODE_BYTES).toString("base64url");
  return { code, codeHash: hashTelegramLinkCode(code) };
}

/** Only the SHA-256 digest is persisted; raw link codes are returned once. */
export function hashTelegramLinkCode(code: string) {
  return createHash("sha256").update(code.trim(), "utf8").digest("hex");
}

export function isTelegramLinkCode(value: string) {
  return /^[A-Za-z0-9_-]{32}$/.test(value);
}

export type TelegramLinkResult = "linked" | "invalid_or_expired" | "group_chat" | "unavailable";

export type TelegramLinkClient = {
  rpc(name: string, params: Record<string, unknown>): Promise<{ data: string | null; error: { code?: string; message: string } | null }>;
};

export class TelegramLinkService {
  constructor(private readonly client: TelegramLinkClient) {}

  async consume(input: { code: string; telegramUserId: string; telegramChatId: string; username?: string; isPrivateChat: boolean }): Promise<TelegramLinkResult> {
    if (!input.isPrivateChat) return "group_chat";
    if (!isTelegramLinkCode(input.code)) return "invalid_or_expired";
    const { error } = await this.client.rpc("consume_telegram_link_code", {
      p_code_hash: hashTelegramLinkCode(input.code),
      p_telegram_user_id: Number(input.telegramUserId),
      p_telegram_chat_id: Number(input.telegramChatId),
      p_username: input.username ?? "",
      p_is_private_chat: true,
    });
    if (!error) return "linked";
    if (error.code === "22023" || error.code === "42501") return "invalid_or_expired";
    return "unavailable";
  }
}
