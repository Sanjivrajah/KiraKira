import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("provides safe recovery destinations", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "This link doesn’t lead anywhere" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Go to start page" })).toHaveAttribute("href", "/");
  });
});
