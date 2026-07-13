import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BusinessForm } from "./business-form";
import { BusinessPreview } from "./business-preview";

describe("business onboarding components", () => {
  it("moves valid normalized details to review", async () => {
    const onReview = vi.fn();
    render(<BusinessForm onReview={onReview} />);
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "  Kedai   Aina " } });
    fireEvent.change(screen.getByLabelText("Business type"), { target: { value: "retail" } });
    fireEvent.click(screen.getByRole("button", { name: "Review details" }));
    await waitFor(() => expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ name: "Kedai Aina", type: "retail" })));
  });

  it("renders all review fields", () => {
    render(<BusinessPreview business={{
      name: "Kedai Aina",
      type: "retail",
      registrationNumber: "202601",
      tin: "C123",
      currency: "MYR",
      preferredLanguage: "ms",
    }} onComplete={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText("Kedai Aina")).toBeInTheDocument();
    expect(screen.getByText("Retail")).toBeInTheDocument();
    expect(screen.getByText("202601")).toBeInTheDocument();
    expect(screen.getByText("C123")).toBeInTheDocument();
    expect(screen.getByText("MYR — Malaysian ringgit")).toBeInTheDocument();
    expect(screen.getByText("Bahasa Malaysia")).toBeInTheDocument();
  });
});
