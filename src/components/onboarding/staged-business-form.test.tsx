import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_BUSINESS_ONBOARDING } from "@/frontend/view-models";
import { render } from "@/test/render";
import { StagedBusinessForm } from "./staged-business-form";

describe("staged business onboarding", () => {
  it("keeps compliance optional during the initial basic setup", () => {
    const onNext = vi.fn();
    const onChange = vi.fn();
    render(<StagedBusinessForm step={1} values={{ ...EMPTY_BUSINESS_ONBOARDING, legalName: "Kedai Baru" }} onChange={onChange} onNext={onNext} />);
    expect(screen.queryByLabelText("TIN")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("exposes the complete compliance profile at its dedicated stage", () => {
    render(<StagedBusinessForm step={3} values={EMPTY_BUSINESS_ONBOARDING} onBack={vi.fn()} onChange={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByLabelText("TIN")).toBeInTheDocument();
    expect(screen.getByLabelText("SST registration")).toBeInTheDocument();
    expect(screen.getByLabelText("MSIC code")).toBeInTheDocument();
    expect(screen.getByLabelText("Business activity description")).toBeInTheDocument();
  });
});

