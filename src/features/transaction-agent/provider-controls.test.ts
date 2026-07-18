import { describe, expect, it, vi } from "vitest";
import { ProviderTimeoutError, runReadOnlyProviderCall } from "./provider-controls";

describe("provider controls", () => {
  it("retries only the bounded provider operation", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce("safe result");
    await expect(runReadOnlyProviderCall(operation, { retries: 1, timeoutMs: 100 })).resolves.toBe("safe result");
    expect(operation).toHaveBeenCalledTimes(2);
  });
  it("returns a timeout without leaving a retry loop running", async () => {
    await expect(runReadOnlyProviderCall(() => new Promise<string>(() => undefined), { retries: 0, timeoutMs: 1 })).rejects.toBeInstanceOf(ProviderTimeoutError);
  });
});
