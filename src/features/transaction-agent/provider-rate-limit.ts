import { PROVIDER_RATE_LIMIT_MAX_REQUESTS, PROVIDER_RATE_LIMIT_WINDOW_MS } from "@/features/transaction-agent/agent-config";

type RateLimitEntry = { startedAt: number; count: number };

export type ProviderRateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

/**
 * Deliberately process-local: it protects the single long-polling worker from
 * accidental or abusive bursts without becoming an authorization boundary.
 */
export class ProviderRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests = PROVIDER_RATE_LIMIT_MAX_REQUESTS,
    private readonly windowMs = PROVIDER_RATE_LIMIT_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): ProviderRateLimitResult {
    const current = this.now();
    const existing = this.entries.get(key);
    if (!existing || current - existing.startedAt >= this.windowMs) {
      this.entries.set(key, { startedAt: current, count: 1 });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }
    if (existing.count >= this.maxRequests) {
      return { allowed: false, retryAfterMs: Math.max(0, this.windowMs - (current - existing.startedAt)) };
    }
    existing.count += 1;
    return { allowed: true, remaining: this.maxRequests - existing.count };
  }
}
