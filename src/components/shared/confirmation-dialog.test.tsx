import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "./confirmation-dialog";

describe("ConfirmationDialog hardening", () => {
  it("contains focus, closes with Escape, and restores page scrolling", async () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmationDialog description="This cannot be undone." onCancel={onCancel} onConfirm={vi.fn()} open title="Reset demo?" />,
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    confirm.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();

    rerender(<ConfirmationDialog description="This cannot be undone." onCancel={onCancel} onConfirm={vi.fn()} open={false} title="Reset demo?" />);
    expect(document.body.style.overflow).toBe("");
  });
});
