# Stage 4: Taxpayer and intermediary OAuth authentication

## Goal

Implement server-only MyInvois OAuth for taxpayer and intermediary modes so an enabled Invoice v1.0 connection can be verified independently in sandbox and production. This stage does not sign or submit documents.

## Connection contract

Persist tenant-scoped, environment-specific connection metadata: authentication mode, represented taxpayer TIN and registration identity, credential-set identifier, references to OAuth client ID and secret, enabled state, verification audit fields, and fixed `document_version = '1.0'`.

The active DTO, repository selection, API, and UI must not expose certificate metadata, certificate secret references, private-key references, or signing actions. Historical database columns and signed-snapshot tables are deprecated compatibility artifacts only.

## Authentication behavior

- Support direct taxpayer login and intermediary login with the official represented-taxpayer header.
- Resolve credentials from a server-side secret provider only.
- Keep sandbox and production URLs and credentials separate.
- Cache tokens by environment, credential set, represented taxpayer, and scope; refresh before expiry and coalesce concurrent requests.
- Never log tokens, client secrets, raw authorization headers, or unredacted provider responses.
- Verify that the configured represented identity matches the tenant connection before login.
- Return safe, actionable failures for disabled connections, missing secrets, identity mismatch, permission failure, throttling, and provider unavailability.

## API and permissions

`POST /api/e-invoices/connections` accepts only a connection-test action. It requires an authenticated tenant member with the configured administrative role, validates strict input, resolves the connection inside the tenant boundary, performs OAuth, and records verification. There is no signing endpoint.

## Tests and exit criteria

- Taxpayer and intermediary request shape, including represented-taxpayer identity.
- Sandbox/production isolation and disabled-connection rejection.
- Token caching, early refresh, and concurrent refresh coalescing.
- Missing-secret, permission, throttling, timeout, and safe-redaction behavior.
- Tenant membership and administrative authorization on the route.
- Negative coverage proving signing actions and certificate fields are rejected.

Stage 4 is complete when a configured sandbox connection obtains and safely caches an official OAuth token without any certificate or signing dependency.
