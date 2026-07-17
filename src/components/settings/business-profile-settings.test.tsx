import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Business } from "@/types";
import { BusinessProfileSettings } from "./business-profile-settings";

const mutateAsync = vi.fn();

vi.mock("@/hooks/use-business", () => ({
  useUpdateBusinessCompliance: () => ({ mutateAsync, isPending: false, isError: false, error: null }),
}));

const business: Business = {
  id: "business-1",
  name: "Bazoot Nasi Lemak",
  type: "other",
  registrationNumber: "202601012345",
  tin: "C12345678900",
  currency: "MYR",
  preferredLanguage: "en",
  legalName: "Bazoot Nasi Lemak",
  entityType: "sole_proprietorship",
  createdAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:00:00.000Z",
};

beforeEach(() => mutateAsync.mockReset().mockResolvedValue(business));

describe("BusinessProfileSettings", () => {
  it("keeps supplier details read-only until the owner chooses to edit", () => {
    render(<BusinessProfileSettings business={business} />);

    expect(screen.getByText("Supplier legal name")).toBeInTheDocument();
    expect(screen.queryByLabelText("MSIC code (required)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit business details" }));
    expect(screen.getByLabelText("MSIC code (required)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("shows actionable validation instead of submitting incomplete supplier data", () => {
    render(<BusinessProfileSettings business={business} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit business details" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Enter the 5-digit MSIC code.")).toBeInTheDocument();
    expect(screen.getByText("Enter the registered address.")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("saves the reusable compliance fields and explains how to refresh preparation", async () => {
    render(<BusinessProfileSettings business={business} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit business details" }));
    fireEvent.change(screen.getByLabelText("MSIC code (required)"), { target: { value: "56101" } });
    fireEvent.change(screen.getByLabelText("Business activity description (required)"), { target: { value: "Food and beverage services" } });
    fireEvent.change(screen.getByLabelText("Business phone (required)"), { target: { value: "+60123456789" } });
    fireEvent.change(screen.getByLabelText("Registered address line 1 (required)"), { target: { value: "1 Jalan Niaga" } });
    fireEvent.change(screen.getByLabelText("City (required)"), { target: { value: "Kuala Lumpur" } });
    fireEvent.change(screen.getByLabelText("State (required)"), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      businessId: "business-1",
      msicCode: "56101",
      businessActivityDescription: "Food and beverage services",
      phone: "+60123456789",
      addressLine1: "1 Jalan Niaga",
      city: "Kuala Lumpur",
      stateCode: "14",
      countryCode: "MY",
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("prepare the invoice again");
    expect(screen.getByRole("link", { name: "Return to e-Invoice preparation" })).toHaveAttribute("href", "/e-invoices");
  });
});
