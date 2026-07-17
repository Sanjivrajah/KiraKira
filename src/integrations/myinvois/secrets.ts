import "server-only";
import type { MyInvoisEnvironment } from "@/application/e-invoices";

export interface SecretProvider {
  resolve(reference: string, expectedEnvironment: MyInvoisEnvironment): Promise<string>;
}

export class MyInvoisSecretError extends Error {
  constructor(readonly code: "secret.invalid_reference" | "secret.environment_mismatch" | "secret.not_configured") {
    super(code === "secret.environment_mismatch"
      ? "The configured secret belongs to a different MyInvois environment."
      : "A required MyInvois secret is not configured.");
    this.name = "MyInvoisSecretError";
  }
}

/**
 * Resolves opaque references in the form `env:sandbox:VARIABLE_NAME`.
 * Only the reference is persisted; the value remains in the server process.
 */
export class EnvironmentSecretProvider implements SecretProvider {
  async resolve(reference: string, expectedEnvironment: MyInvoisEnvironment): Promise<string> {
    const match = /^env:(sandbox|production):([A-Z][A-Z0-9_]*)$/.exec(reference);
    if (!match) throw new MyInvoisSecretError("secret.invalid_reference");
    if (match[1] !== expectedEnvironment) throw new MyInvoisSecretError("secret.environment_mismatch");
    const value = process.env[match[2]];
    if (!value) throw new MyInvoisSecretError("secret.not_configured");
    return value;
  }
}

