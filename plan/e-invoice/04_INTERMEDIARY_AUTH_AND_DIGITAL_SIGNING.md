# Stage 4: Intermediary Authentication and Digital Signing

## Goal

Implement server-only MyInvois intermediary token management and digital signing for Invoice v1.1 payload snapshots. This stage proves authentication and signing boundaries but does not expose general batch submission to users.

## Authentication model

Assume NiagaAI acts as an intermediary representing a taxpayer. Make the authentication mode explicit so a future direct-taxpayer mode cannot accidentally reuse intermediary behaviour.

For intermediary login:

- Call `POST /connect/token` on the configured Identity Service base URL.
- Use `client_credentials`.
- Send the mandatory `onbehalfof` header for the active taxpayer.
- Support TIN and `TIN:ROB` formats through a validated taxpayer-identity value.
- Cache the access token by environment, intermediary credential set, and represented business.
- Refresh shortly before expiry and on one authorised retry after a 401.
- Apply exponential backoff and respect login throttling.
- Never persist bearer tokens in browser storage, logs, analytics, or client-readable tables.

## Connection model

Persist only non-secret configuration and secret references:

```text
myinvois_connections
- business_id
- environment
- auth_mode
- taxpayer_tin
- taxpayer_registration_scheme/value
- onbehalfof_value
- client_id_secret_ref
- client_secret_secret_ref
- signing_certificate_secret_ref
- signing_private_key_secret_ref
- signing_key_passphrase_secret_ref
- enabled / verified_at / verified_by
```

If one intermediary credential is shared across tenants, model it as platform configuration and keep only taxpayer delegation data per business. Do not duplicate shared secrets into tenant rows.

The current portal logout URL is not part of this flow. Backend integration uses token expiry/refresh; it does not automate the portal's browser logout page.

## Secret and certificate boundary

- Resolve secrets only in a server runtime.
- Prefer a managed secret store or KMS/HSM-compatible signing provider.
- Never return private-key material to application code outside the signing adapter.
- Record certificate thumbprint, subject, issuer, serial number, and expiry as non-secret operational metadata.
- Add alerts/checks for impending certificate expiry.
- Separate sandbox and production credentials and certificates.

## Signing service

Create a signing interface independent from MyInvois HTTP transport:

```text
signPayload(snapshot, signingContext) -> signedSnapshot + signingMetadata
```

The implementation must follow the current official MyInvois digital-signature guide for Invoice v1.1, including the required UBL extension and signature structures. Do not invent a generic detached signature if the official payload requires embedded elements.

Persist an immutable signed snapshot containing:

- Source unsigned snapshot ID and hash.
- Exact signed payload bytes.
- Hash of the exact signed bytes used for submission.
- Certificate thumbprint and non-secret metadata.
- Signing algorithm and implementation version.
- Signing timestamp.

Never overwrite an unsigned or signed snapshot. A signing retry either returns the existing idempotent result or creates a clearly linked new attempt after an explicit failure.

## Server endpoints and authorisation

Provide narrow server actions/routes for:

- Testing a connection without exposing token contents.
- Inspecting non-secret certificate metadata.
- Signing one approved payload snapshot.

Require active business membership and an elevated role such as owner/admin/accountant for connection setup. Signing should require the approval captured in Stage 2.

## Tests

- `onbehalfof` is derived from the selected business, never request input alone.
- Tokens are cached and refreshed without login storms.
- Concurrent token requests collapse into one refresh.
- Secrets and tokens are redacted from errors and logs.
- Cross-business access cannot reuse another taxpayer's connection context.
- Sandbox and production configuration cannot mix.
- Signing output verifies cryptographically and is deterministic where the official algorithm permits.
- Certificate expiry and invalid-chain failures are actionable.
- Exact signed-byte hash is stable and stored.

## Out of scope

- User-facing multi-document submission.
- Submission status polling.
- Cancellation/rejection workflows.
- Production activation.

## Deliverables

- MyInvois connection migration and repository.
- Secret-provider and token-cache interfaces.
- Intermediary OAuth client.
- Digital-signing adapter and immutable signed snapshots.
- Connection-test and single-snapshot signing services.
- Security and certificate-operations documentation.

## Handoff to Stage 5

Stage 5 may start only when a selected business can acquire a sandbox intermediary token without browser exposure and an approved payload can be signed and independently verified using its configured certificate.

