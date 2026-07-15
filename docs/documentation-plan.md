# Documentation plan

## Goal

Make NiagaAI understandable to a new contributor or AI agent without requiring
them to infer product boundaries and layering from the entire codebase.

## Completed in this pass

- Added `docs/README.md` as the agent-oriented documentation hub.
- Documented the project’s two application surfaces and their data boundaries.
- Documented the web application layers, canonical migration strategy, and
  external-extraction boundaries.
- Captured repository-specific engineering patterns and verification rules.
- Documented the Telegram agent’s runtime, workflow, ownership, integrity
  safeguards, and safe extension pattern.
- Linked the hub from `AGENTS.md`, which is the mandatory entry point for
  coding agents.

## Deliberately not duplicated

- `PRODUCT.md` remains the product source of truth.
- Root `README.md` remains the developer/user setup and demo guide.
- `AGENTS.md` remains the authoritative engineering policy.
- Existing `plan/` documents remain staged implementation plans rather than
  evergreen architecture documentation.

## Maintenance checklist

Update this documentation when a change does any of the following:

1. Adds, removes, or connects a user workflow or application surface.
2. Changes a storage key, migration version, repository contract, or data
   ownership boundary.
3. Moves a rule between route/component/hook/service/repository/domain layers.
4. Adds an environment variable, external provider, supported media type, bot
   command, callback action, or generated local file.
5. Changes a product claim about confirmation, compliance, submissions,
   security, or persistence.

## Suggested future additions

Add focused docs only when the implementation becomes real enough to need
them: a production persistence/deployment runbook, an authenticated API/data
access guide, a formal MyInvois integration contract, and an end-to-end testing
playbook. Avoid speculative documentation for integrations that are still out
of scope.
