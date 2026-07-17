import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Business } from "@/types";
import { MyInvoisConnectionSettings } from "./myinvois-connection-settings";

const business: Business = {
  id: "business-1",
  name: "Bazoot Nasi Lemak",
  type: "other",
  registrationNumber: "202601012345",
  registrationScheme: "brn",
  tin: "C12345678900",
  currency: "MYR",
  preferredLanguage: "en",
  entityType: "sole_proprietorship",
  createdAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:00:00.000Z",
};

describe("MyInvoisConnectionSettings", () => {
  it("keeps connection details read-only until the owner chooses to edit", () => {
    render(<MyInvoisConnectionSettings business={business} />);

    expect(screen.getByText("Connection type")).toBeInTheDocument();
    expect(screen.queryByLabelText("Taxpayer TIN")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit connection" }));
    expect(screen.getByLabelText("Taxpayer TIN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("restores the prefilled taxpayer details when editing is cancelled", () => {
    render(<MyInvoisConnectionSettings business={business} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit connection" }));
    fireEvent.change(screen.getByLabelText("Taxpayer TIN"), { target: { value: "C00000000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("C12345678900")).toBeInTheDocument();
    expect(screen.queryByLabelText("Taxpayer TIN")).not.toBeInTheDocument();
  });
});
