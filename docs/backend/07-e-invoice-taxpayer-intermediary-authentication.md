# MyInvois taxpayer and intermediary authentication

NiagaAI authenticates unsigned Invoice v1.0 operations with server-only OAuth. A connection is tenant-scoped and environment-specific and may represent the taxpayer directly or use an intermediary identity plus the official `onbehalfof` value.

The active application stores only OAuth and represented-taxpayer connection metadata. Client IDs and secrets are indirect secret references resolved on the server. The browser receives neither their values nor historical certificate/signing columns.

`POST /api/e-invoices/connections` supports `test_connection` only. The route verifies membership and administrative permission, loads the connection through the tenant boundary, obtains a token, confirms the represented identity, and records verification. Sandbox and production verification are independent.

Tokens are cached by environment, credential set, represented taxpayer, and scope, refreshed before expiry, and shared across concurrent requests. Logs and returned errors redact tokens, secrets, authorization headers, and raw provider data.

Historical signing migrations and tables remain to protect upgraded databases from destructive migration risk. The forward v1.0-only migration revokes normal application access; there is no signing service, signed-snapshot repository, certificate-management DTO, UI action, or `/api/e-invoices/signing` route.

Operational configuration and the sandbox lifecycle are described in `08-e-invoice-sandbox-submission-status.md`. Production activation and emergency disable are described in `09-e-invoice-production-operations.md`.
