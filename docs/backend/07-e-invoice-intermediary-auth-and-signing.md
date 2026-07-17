# MyInvois intermediary authentication and digital signing

Stage 4 adds a server-only boundary for testing one business connection and
signing one approved Invoice v1.1 payload snapshot. It does not submit
documents, poll status, or activate production.

## Authority and tenant boundary

`myinvois_connections` is unique by business and environment. The represented
identity is generated from the stored taxpayer TIN and optional ROB value; API
callers cannot provide an `onbehalfof` override. Owners, admins, and accountants
may test, inspect, or sign through `/api/e-invoices/signing`. The unsigned
snapshot lookup repeats the `business_id` boundary, and signing fails if the
snapshot and connection businesses differ.

The authentication mode is explicitly `intermediary`. A future direct-taxpayer
mode needs a separate implementation rather than silently omitting
`onbehalfof`.

## Secret references

Database rows contain references, never credentials, tokens, certificates, or
private keys. The built-in server provider accepts references in this form:

```text
env:sandbox:MYINVOIS_SANDBOX_CLIENT_ID
env:sandbox:MYINVOIS_SANDBOX_CLIENT_SECRET
env:sandbox:MYINVOIS_SANDBOX_SIGNING_CERTIFICATE_PEM
env:sandbox:MYINVOIS_SANDBOX_SIGNING_PRIVATE_KEY_PEM
env:sandbox:MYINVOIS_SANDBOX_SIGNING_KEY_PASSPHRASE
env:sandbox:MYINVOIS_SANDBOX_SIGNING_CERTIFICATE_CHAIN_PEM
```

Production references must use `env:production:...`. Resolution rejects a
sandbox/production mismatch before any login or signing attempt. Deployments
should replace the environment provider with a managed secret store or
KMS/HSM-backed adapter while preserving the same `SecretProvider` boundary.
Private-key material is resolved and used only inside the signing adapter.

The optional identity URL overrides are
`MYINVOIS_SANDBOX_IDENTITY_BASE_URL` and
`MYINVOIS_PRODUCTION_IDENTITY_BASE_URL`. Defaults are the official preproduction
and production API hosts. Do not point one environment at the other.

## Token lifecycle

The intermediary client posts `client_credentials` to `/connect/token` with the
stored `onbehalfof` header. Tokens are cached by environment, intermediary
credential set, business, and represented taxpayer. Concurrent misses share one
login promise. Refresh begins two minutes before expiry, transient failures use
bounded exponential backoff, `Retry-After` is respected, and an authorised API
call may invalidate and refresh once after a 401.

Connection tests return only status, mode, represented identity, environment,
and expiry time. Token values and provider error bodies are not returned or
logged.

## Invoice v1.1 signing

The JSON adapter follows the official MyInvois XAdES transliteration:

1. Hash the exact immutable unsigned UTF-8 bytes with SHA-256.
2. Sign those bytes with RSA-SHA256 and verify the result with the certificate.
3. Hash the DER certificate and the minified signed-properties object.
4. Embed one `UBLExtensions` XAdES structure and the required invoice-level
   `Signature` element.
5. Hash and persist the exact signed UTF-8 bytes.

Retries with the same unsigned snapshot, certificate thumbprint, and signer
implementation return the existing immutable signed snapshot. Corrections
require a new approved preparation and unsigned snapshot. Signed and unsigned
bytes are never updated or deleted by application roles.

Primary implementation references are the official
[Signature guide](https://sdk.myinvois.hasil.gov.my/signature/),
[JSON signing guide](https://sdk.myinvois.hasil.gov.my/signature-creation-json/),
and [intermediary login API](https://sdk.myinvois.hasil.gov.my/api/08-login-as-intermediary-system/).

## Certificate operations

Certificate inspection stores only SHA-256 thumbprint, subject, issuer, serial
number, and validity dates. Signing fails with an actionable code when the
certificate is invalid, not yet valid, expired, does not match the private key,
or fails a configured chain. `expiresWithinDays` is returned by inspection;
operations should alert at 60, 30, 14, and 7 days before `certificate_not_after`
and block signing at expiry.

Use separate sandbox and production organisation signing certificates. Rotate
by adding the new secret version, testing the connection and certificate, then
updating the reference. Existing signed snapshots retain the old thumbprint and
certificate metadata for auditability.

## Stage 5 handoff

Stage 5 may consume only the immutable `signed_payload` and
`signed_payload_hash`. General batch submission, polling, cancellation,
rejection, and production activation remain out of scope.

