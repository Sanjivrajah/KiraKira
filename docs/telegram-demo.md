# Telegram demo runbook

This walkthrough uses synthetic local JSON data. It does not touch Supabase, browser records, or production Telegram data.

## Prepare the demo store

```bash
npm run demo:agent -- seed --directory ./data/demo-agent
```

The command creates a marker file, three confirmed transactions, and one overdue receivable for the synthetic `demo-owner`. Set the bot to use the same directory:

```text
BOT_PERSISTENCE_MODE=local
LOCAL_DATA_DIRECTORY=./data/demo-agent
```

Start the worker with a non-production Telegram bot and synthetic accounts only:

```bash
npm run bot:dev
```

## Three-to-five-minute walkthrough

1. Open `/start` and show the persistent home keyboard.
2. Open recent transactions and the current summary—the seeded income and expense records make the result deterministic.
3. Send `Semalam beli ayam RM85 cash dekat Pasar Borong`.
4. Correct one field, confirm the draft, then press the confirmation button again to show idempotency.
5. Send the same transaction again, show the duplicate warning, and cancel it.
6. Save another small transaction, then use **Undo last save** to show that the record is voided rather than deleted.
7. Ask one `/insights` question and run a bounded `/search`.
8. Export a short date range and explain that the CSV is a transaction export—not an audited statement.

If voice and receipt providers are configured, add one short Manglish voice note and one clear MYR receipt. Keep provider failures visible as recoverable errors; do not switch to a hidden fixture mid-conversation.

## Safety checks

- Use a separate Telegram bot token and demo-only directory.
- Do not use real names, receipts, phone numbers, customer balances, or bank details.
- Keep the demo in `BOT_PERSISTENCE_MODE=local`.
- Do not copy the Railway service-role key into the demo shell.
- Confirm temporary media files disappear after both success and failure.
- Show that no record exists until the review action is confirmed.

## Reset

Stop the bot, then run:

```bash
npm run demo:agent -- reset --directory ./data/demo-agent
```

Reset is deliberately narrow. The directory name must contain `demo`, and the seed command must have created `.niagaai-agent-demo`. Only the known demo JSON files are removed—the marker remains so the directory can be seeded and reset again.

## Before a live presentation

Run the focused Telegram tests and the normal repository checks. On both Telegram mobile and desktop, verify English and Malay copy, long text, constrained buttons, natural-language corrections, stale callbacks, duplicate confirmation, undo expiry, and provider errors.
