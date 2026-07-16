import { describe, expect, it, vi } from "vitest";
import { TelegramLinkService, createTelegramLinkCode, hashTelegramLinkCode, isTelegramLinkCode } from "./telegram-linking";

describe("Telegram link codes", () => {
  it("creates an opaque code and persists only its stable hash", () => {
    const { code, codeHash } = createTelegramLinkCode();
    expect(isTelegramLinkCode(code)).toBe(true);
    expect(codeHash).toBe(hashTelegramLinkCode(code));
    expect(codeHash).not.toContain(code);
  });

  it("does not call the database for malformed codes or group chats", async () => {
    const rpc = vi.fn();
    const service = new TelegramLinkService({ rpc });
    await expect(service.consume({ code: "guessed", telegramUserId: "1", telegramChatId: "2", isPrivateChat: true })).resolves.toBe("invalid_or_expired");
    await expect(service.consume({ code: createTelegramLinkCode().code, telegramUserId: "1", telegramChatId: "2", isPrivateChat: false })).resolves.toBe("group_chat");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps consumed, expired, and outage outcomes without revealing account details", async () => {
    const code = createTelegramLinkCode().code;
    const rpc = vi.fn().mockResolvedValueOnce({ data: "account", error: null }).mockResolvedValueOnce({ data: null, error: { code: "22023", message: "expired" } }).mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "down" } });
    const service = new TelegramLinkService({ rpc });
    await expect(service.consume({ code, telegramUserId: "1", telegramChatId: "2", isPrivateChat: true })).resolves.toBe("linked");
    await expect(service.consume({ code, telegramUserId: "1", telegramChatId: "2", isPrivateChat: true })).resolves.toBe("invalid_or_expired");
    await expect(service.consume({ code, telegramUserId: "1", telegramChatId: "2", isPrivateChat: true })).resolves.toBe("unavailable");
  });
});
