import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteStoredVoiceConversation: vi.fn(),
  loadStoredVoiceConversations: vi.fn(),
}));

vi.mock("./voice-conversation-api", () => ({
  deleteStoredVoiceConversation: mocks.deleteStoredVoiceConversation,
  loadStoredVoiceConversations: mocks.loadStoredVoiceConversations,
}));

import { VoiceConversationHistory } from "./voice-conversation-history";

const conversation = {
  id: "conversation-1",
  status: "completed" as const,
  startedAt: "2026-07-17T02:00:00.000Z",
  endedAt: "2026-07-17T02:05:00.000Z",
  retentionDeleteAfter: "2026-10-15T02:00:00.000Z",
  turns: [
    { index: 1, role: "user" as const, text: "I spent RM45 on petrol", createdAt: "2026-07-17T02:01:00.000Z" },
    { index: 2, role: "assistant" as const, text: "I have prepared that expense.", createdAt: "2026-07-17T02:01:05.000Z" },
  ],
};

describe("VoiceConversationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadStoredVoiceConversations.mockResolvedValue({ enabled: true, conversations: [conversation] });
    mocks.deleteStoredVoiceConversation.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads an inspectable private transcript", async () => {
    render(<VoiceConversationHistory businessId="business-1" refreshKey={0} />);

    expect(await screen.findByText("2 turns")).toBeInTheDocument();
    fireEvent.click(screen.getByText("2 turns"));
    expect(screen.getByText("I spent RM45 on petrol")).toBeInTheDocument();
    expect(screen.getByText("I have prepared that expense.")).toBeInTheDocument();
  });

  it("requires confirmation and removes a deleted conversation", async () => {
    render(<VoiceConversationHistory businessId="business-1" refreshKey={0} />);
    fireEvent.click(await screen.findByText("2 turns"));
    fireEvent.click(screen.getByRole("button", { name: "Delete conversation" }));

    await waitFor(() => expect(mocks.deleteStoredVoiceConversation).toHaveBeenCalledWith("conversation-1"));
    await waitFor(() => expect(screen.queryByText("2 turns")).not.toBeInTheDocument());
  });
});
