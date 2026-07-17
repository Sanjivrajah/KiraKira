import { describe, expect, it } from "vitest";
import { maskSensitiveIdentifier } from "./mask-sensitive-identifier";

describe("maskSensitiveIdentifier", () => {
  it("masks a provided identifier and retains a clear empty state", () => {
    expect(maskSensitiveIdentifier("IG51244626010")).toBe("****");
    expect(maskSensitiveIdentifier(" ")).toBe("Not provided");
  });
});
