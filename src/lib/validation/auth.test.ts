import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./auth";

describe("auth validation", () => {
  it("accepts valid sign-in values and normalizes the email", () => {
    expect(signInSchema.parse({ email: " LINA@NiagaAI.demo ", password: "password1" }).email).toBe(
      "lina@niagaai.demo",
    );
  });

  it("rejects malformed sign-in credentials", () => {
    expect(signInSchema.safeParse({ email: "bad", password: "short" }).success).toBe(false);
  });

  it("rejects mismatched passwords and missing terms", () => {
    const result = signUpSchema.safeParse({
      name: "Lina",
      email: "lina@example.com",
      password: "password1",
      confirmPassword: "password2",
      terms: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["confirmPassword", "terms"]),
      );
    }
  });
});
