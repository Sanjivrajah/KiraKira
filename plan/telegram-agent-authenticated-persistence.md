# Telegram authenticated persistence plan

## Outcome

In Supabase mode, a Telegram chat is explicitly linked to an authenticated
NiagaAI member and a business before the bot accepts financial input. Drafts,
conversation state, confirmed transactions, undo/audit events, preferences,
and redacted orchestration traces are then persisted under that linked
business. Local JSON mode remains a clearly labelled development demo and is
never mixed with Supabase records.

## Identity decision

Do not add a user-entered Telegram username to sign-up. A username can be
absent, renamed, or reassigned. The durable identity is Telegram's numeric
user and private-chat IDs, linked through a short-lived one-time code issued
to the authenticated web session. The Telegram username is optional display
metadata captured only when `/link` is completed.

## Delivery slices

1. **Authenticated link issuance (this slice)**
   - Add an authenticated server endpoint that lists businesses where the user
     is an active transaction-capable member and issues a hashed, ten-minute,
     one-time code.
   - Add a Settings control that lets the user select an eligible business,
     reveals the code once, and gives the exact private-chat `/link` command.
   - Keep raw codes out of logs and persistence; persist only their SHA-256
     digest and expiry.

2. **Bot link and persistence activation**
   - Run the Telegram worker with `BOT_PERSISTENCE_MODE=supabase` plus a
     server-only service-role key.
   - `/link <code>` consumes the code only in a private chat and creates or
     relinks the Telegram account for the authenticated user/business.
   - Reject unlinked input; never fall back to local JSON in Supabase mode.

3. **Financial and conversation persistence**
   - Persist active drafts and workflow state in `telegram_conversation_states`.
   - Persist only owner-confirmed records in shared `transactions`; database
     RPCs enforce business ownership, idempotent confirmation, and audited
     void/undo.
   - Keep raw transcripts/receipt text out of orchestration traces.

4. **Release verification and operational handoff**
   - Apply Supabase migrations and regenerate database types.
   - Test issue, expiry, reuse, private-chat-only linking, unlink/relink,
     unlinked rejection, cross-business isolation, duplicate callbacks,
     confirmation, undo, and web visibility of the resulting records.
   - Update the operator runbook with environment and rollback procedures.

## Current boundary

This repository already contains the Supabase Telegram repositories and
database RPCs for slices 2 and 3. This plan adds the missing authenticated web
entry point in slice 1 without modifying unrelated in-progress Telegram
workflow work.
