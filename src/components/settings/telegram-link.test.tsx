import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramLink } from "./telegram-link";

const writeText = vi.fn();

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ mode: "supabase", status: "authenticated" }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

describe("TelegramLink", () => {
  it("copies the complete Telegram link command and confirms success", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ businesses: [{ id: "business-1", name: "Bazoot Nasi Lemak" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "ABC123", expiresAt: "2026-07-18T12:00:00.000Z" }), { status: 200 }));

    render(<TelegramLink />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create link code" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Create link code" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy link message" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/link ABC123"));
    expect(screen.getByRole("button", { name: "Link message copied" })).toHaveTextContent("Copied");
  });

  it("offers a manual recovery when clipboard access fails", async () => {
    writeText.mockRejectedValue(new Error("Clipboard access denied"));
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ businesses: [{ id: "business-1", name: "Bazoot Nasi Lemak" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "ABC123", expiresAt: "2026-07-18T12:00:00.000Z" }), { status: 200 }));

    render(<TelegramLink />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create link code" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Create link code" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy link message" }));

    expect(await screen.findByText("Could not copy the link message. Select and copy it manually.")).toBeInTheDocument();
  });
});
