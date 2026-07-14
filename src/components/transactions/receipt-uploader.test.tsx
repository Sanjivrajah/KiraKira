import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReceiptUploader } from "./receipt-uploader";

describe("ReceiptUploader hardening", () => {
  it("rejects oversized files before making a network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<ReceiptUploader onBack={vi.fn()} onExtracted={vi.fn()} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [oversized] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("between 1 byte and 10 MB");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("supports multi-file selection and keeps extraction disabled when empty", () => {
    const { container } = render(<ReceiptUploader onBack={vi.fn()} onExtracted={vi.fn()} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;

    expect(input).toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: /Extract receipts/ })).toBeDisabled();
  });
});
