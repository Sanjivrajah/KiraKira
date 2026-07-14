export type RepositoryErrorCode = "READ_FAILED" | "WRITE_FAILED" | "NOT_FOUND" | "INVALID_DATA";

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: RepositoryErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RepositoryError";
  }
}
