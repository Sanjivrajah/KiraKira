import { describe, expect, it } from "vitest";
import { resolveVoiceOwnerName } from "./owner-name";

describe("resolveVoiceOwnerName", () => {
  it("prefers the canonical profile name", () => {
    expect(resolveVoiceOwnerName("Sanjivrajah", "Official Sanjivrajah")).toBe("Sanjivrajah");
  });

  it("falls back to auth metadata when no profile name is available", () => {
    expect(resolveVoiceOwnerName(null, "  Sanjivrajah  ")).toBe("Sanjivrajah");
  });

  it("uses a neutral greeting rather than deriving a name from email", () => {
    expect(resolveVoiceOwnerName(undefined, "   ")).toBe("there");
  });
});
