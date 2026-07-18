# Stage 6: Production Hardening and Operations

## Goal

Prepare the completed sandbox workflow for a controlled production rollout with security review, operational controls, reconciliation, observability, recovery procedures, and explicit activation gates.

## Approved v1.0 production constraint

NiagaAI will submit **unsigned MyInvois Invoice v1.0** documents because an organisation digital certificate is not currently available. Invoice v1.1 signing and certificate operations are not activation requirements for this rollout. As reverified on 17 July 2026, the official MyInvois FAQ states that v1.0 may be submitted without digital-signature validation until HASiL announces its retirement; the document-types page also warns that v1.0 will be deprecated later.

This is a controlled compatibility choice, not a claim that v1.0 is permanent. Operations must monitor HASiL release notices. If v1.0 retirement is announced, production must be disabled before the effective date and must not silently switch payload versions.

## Production activation model

- Production is disabled by default per business.
- Enabling production requires an authorised role, verified taxpayer delegation, valid OAuth credentials, completed v1.0 sandbox checklist, and explicit confirmation. A signing certificate is intentionally not required for v1.0.
- Sandbox and production records, tokens, secrets, endpoints, queues, and metrics must remain distinguishable.
- UI must always show the active environment before approval and submission.
- Never automatically promote sandbox configuration to production.

## Permissions and approvals

Define and enforce a permission matrix for:

- Viewing e-Invoice records.
- Editing reusable business/customer data.
- Editing document supplements.
- Approving revisions.
- Managing OAuth credential references.
- Submitting batches.
- Retrying failed transport attempts.
- Cancelling valid documents.
- Viewing audit and raw diagnostic data.

High-risk actions require recent authentication and clear confirmation. Record actor, business, environment, target records, reason, timestamp, and outcome.

## Operational resilience

- Durable queue with lease/claim semantics for submissions and polling.
- Safe recovery after worker restarts.
- Dead-letter handling with an operator-visible reason.
- Rate limiting per MyInvois client ID and endpoint.
- Exponential backoff with jitter and `Retry-After` support.
- Circuit breaking for sustained upstream failures.
- Bounded retries and manual recovery controls.
- Token refresh single-flight behaviour across workers.
- Database constraints preventing duplicate active submissions.
- Backup and retention strategy for immutable payloads and audit history.

## Observability

Capture structured, redacted metrics and logs for:

- Token acquisition success/failure and latency.
- Submission count, document count, encoded size, latency, and HTTP outcome.
- Accepted/rejected ratios.
- Time spent in Submitted/Processing.
- Valid/Invalid outcomes and validation categories.
- Retry, throttling, duplicate, and permission errors.
- Queue depth, stuck jobs, and reconciliation lag.

Use correlation IDs, local submission IDs, and MyInvois submission UIDs. Do not log bearer tokens, credentials, private keys, full unredacted documents, or unnecessary personal data.

## Reconciliation and audit

- Provide an operator-safe reconciliation job using locally stored submission UIDs and document UUIDs.
- Do not use broad Search Documents calls as the normal reconciliation mechanism.
- Detect local/external state divergence without overwriting history.
- Preserve raw upstream error structures in restricted storage and show redacted actionable summaries to ordinary users.
- Provide exportable audit history for a business and document.
- Define retention and deletion rules compatible with tax, privacy, and business requirements before production use.

## Secret and version-lifecycle operations

- Secret rotation without redeploying browser assets.
- Immediate connection disable/revoke control.
- Restricted access to connection diagnostics.
- Runbook for compromised OAuth credentials.
- Alert and disable gate for any announced MyInvois v1.0 retirement date.

Certificate expiry and signing-key rotation apply only if the product later adopts v1.1 and obtains an organisation certificate; they are not part of this v1.0 production rollout.

## Cancellation and correction

Implement controlled cancellation only against eligible valid MyInvois documents:

- Confirm status and deadline.
- Require a reason.
- Submit through a server-only service.
- Persist the request and resulting status events.
- Keep the local source invoice and immutable payload history.
- Route post-deadline corrections through appropriate credit/debit/refund document flows rather than destructive editing.

## Security review checklist

- Tenant isolation and RLS penetration tests.
- Server-route authorisation tests independent of the UI.
- SSRF-safe fixed upstream base URLs.
- Strict timeouts and response-size limits.
- Zod/schema validation of all upstream responses.
- No service-role or MyInvois secrets in client bundles.
- Encrypted secret and payload storage as required.
- Dependency and cryptography review.
- Replay, duplicate, stale-approval, and confused-deputy tests.
- Data minimisation and redaction review.

## Production-readiness verification

- Run the full repository verification gate.
- Run migration tests against a clean database and an upgraded representative database.
- Load-test token caching, batching, submission throttles, and poll workers below official limits.
- Exercise expired token, 401, 403, 422, 429, timeout, oversized or malformed response, and upstream outage scenarios. Invalid-certificate testing is not applicable to unsigned v1.0.
- Complete sandbox tests for every enabled document type and scenario.
- Conduct a small controlled production pilot with explicit rollback/disable steps.

## Documentation and runbooks

Deliver:

- Configuration guide for sandbox and production.
- Taxpayer delegation and intermediary setup checklist.
- v1.0 support-lifecycle monitoring and controlled-disable guide.
- Submission failure and stuck-processing runbook.
- Invalid-document correction guide.
- Cancellation/correction guide.
- Incident response and credential-compromise runbook.
- Support-facing status and error glossary.

## Completion criteria

Production rollout is ready only when:

- No secret or signing operation is browser-accessible.
- Tenant isolation is verified at database and server boundaries.
- Duplicate submission protections are demonstrated.
- Queue recovery and reconciliation are tested.
- Alerts and runbooks exist for v1.0 retirement, authentication, submission, cancellation, and polling failures.
- A controlled pilot can be disabled without losing immutable local history.
- Product copy clearly distinguishes prepared, submitted, valid, invalid, and cancelled states.
