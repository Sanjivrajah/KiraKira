import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceRecorder } from "./voice-recorder";

afterEach(() => vi.restoreAllMocks());

describe("VoiceRecorder", () => {
  it("uploads audio and returns a reviewable voice draft", async () => {
    const onExtracted = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      transcript: "Bought stock for RM50",
      languageCode: "eng",
      languageProbability: 0.99,
      warnings: [],
      draft: { type: "expense", date: "2026-07-14", amount: 50, category: "Inventory", description: "Bought stock", counterpartyName: "", paymentMethod: "", source: "voice" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { container } = render(<VoiceRecorder onBack={vi.fn()} onExtracted={onExtracted} />);
    const file = new File(["audio"], "note.webm", { type: "audio/webm" });

    fireEvent.change(container.querySelector("input[type='file']") as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Transcribe and review" }));

    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));
    expect(onExtracted.mock.calls[0][0]).toMatchObject({ transcript: "Bought stock for RM50", draft: { amount: 50, source: "voice" } });
  });

  it("rejects an oversized file before calling the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<VoiceRecorder onBack={vi.fn()} onExtracted={vi.fn()} />);
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.webm", { type: "audio/webm" });

    fireEvent.change(container.querySelector("input[type='file']") as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("between 1 byte and 25 MB");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
