import { describe, expect, it } from "vitest";
import { ProviderRateLimiter } from "./provider-rate-limit";

describe("ProviderRateLimiter", () => {
  it("bounds provider-heavy requests by owner/chat and resets after its window", () => {
    let now = 1_000;
    const limiter = new ProviderRateLimiter(2, 60_000, () => now);
    expect(limiter.check("owner:chat")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check("owner:chat")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.check("owner:chat")).toMatchObject({ allowed: false, retryAfterMs: 60_000 });
    expect(limiter.check("other:chat")).toMatchObject({ allowed: true });
    now += 60_000;
    expect(limiter.check("owner:chat")).toMatchObject({ allowed: true, remaining: 1 });
  });
});
