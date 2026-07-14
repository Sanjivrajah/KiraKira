import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoSourceInput } from "./demo-source-input";

describe("DemoSourceInput transaction imports", () => {
  it("parses a CSV locally and returns every valid row", async () => {
    const onImported = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<DemoSourceInput onBack={vi.fn()} onContinue={vi.fn()} onImported={onImported} source="csv" />);
    const file = new File(["placeholder"], "transactions.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("Date,Type,Amount,Description\n2026-07-13,income,120,Order A\n2026-07-14,expense,20,Supplies"),
    });

    fireEvent.change(container.querySelector("input[type='file']") as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import transactions" }));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(onImported.mock.calls[0][0]).toMatchObject({
      method: "local_csv",
      drafts: [
        { type: "income", amount: 120, source: "csv" },
        { type: "expense", amount: 20, source: "csv" },
      ],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("shows a useful error when the CSV lacks required columns", async () => {
    const { container } = render(<DemoSourceInput onBack={vi.fn()} onContinue={vi.fn()} onImported={vi.fn()} source="csv" />);
    const file = new File(["placeholder"], "bad.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("When,Something\nToday,20") });

    fireEvent.change(container.querySelector("input[type='file']") as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import transactions" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("date column");
  });
});
