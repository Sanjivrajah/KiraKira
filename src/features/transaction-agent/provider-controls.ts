import { PROVIDER_RETRY_COUNT, PROVIDER_TIMEOUT_MS } from "@/features/transaction-agent/agent-config";

export class ProviderTimeoutError extends Error { constructor() { super("Provider request timed out."); this.name = "ProviderTimeoutError"; } }

/** Retry only idempotent, read-only provider work. Database effects stay outside this wrapper. */
export async function runReadOnlyProviderCall<T>(operation: () => Promise<T>, options: { timeoutMs?: number; retries?: number } = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const retries = options.retries ?? PROVIDER_RETRY_COUNT;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ProviderTimeoutError()), timeoutMs); })]);
    } catch (error) { lastError = error; }
    finally { if (timer) clearTimeout(timer); }
  }
  throw lastError;
}
