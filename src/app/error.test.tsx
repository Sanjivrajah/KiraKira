import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteError from "./error";

describe("RouteError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers a retry without exposing the internal error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const retry = vi.fn();

    render(<RouteError error={new Error("private failure details")} unstable_retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Your records have not been changed");
    expect(screen.queryByText("private failure details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
