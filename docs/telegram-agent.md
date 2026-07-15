# Telegram transaction agent

## Purpose and boundary

The Telegram agent is a development-only, long-polling bookkeeping assistant.
It accepts English, Bahasa Melayu, and Manglish text or Telegram voice notes,
turns them into a reviewable transaction draft, and saves a record only after
the Telegram user explicitly confirms it.

It is separate from the Next.js browser-local workspace. Its JSON records do
not currently feed the web dashboard, invoices, or canonical browser migration.

## Runtime entry and configuration

Run `npm run bot:dev` for watch mode or `npm run bot:start` for a single
process. `src/bot/index.ts` loads `.env.local`, validates it through
`getBotEnvironment`, registers Telegram commands, starts long polling, and
stops cleanly on `SIGINT`/`SIGTERM`.

Required for the bot:

- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_TRANSACTION_MODEL`
- `ELEVENLABS_API_KEY`

Optional values include `ELEVENLABS_STT_MODEL`, `MAX_VOICE_FILE_BYTES`, and
`LOCAL_DATA_DIRECTORY`. See `.env.example`; do not add secrets to source or
browser-safe environment variables.

## Flow

```text
text or voice note
  → (voice only) download temporary file → ElevenLabs transcription
  → OpenAI structured extraction
  → pending draft persisted locally
  → clarification for required missing fields, if any
  → review keyboard
  → confirm / correct / cancel
  → duplicate warning, when applicable
  → confirmed record or cancelled draft
  → optional five-minute undo marks confirmed record voided
```

`src/bot/telegram-bot.ts` is transport and presentation orchestration. Keep
its handlers thin; place use-case rules in `src/features/transaction-agent`.

## Feature ownership

| Concern | Location |
| --- | --- |
| Structured extraction schema and model calls | `transaction.schema.ts`, `transaction-extractor.ts` |
| Active conversation state and expiry | `conversation-state.ts`, `conversation-service.ts` |
| Missing-field selection and wording | `clarification.ts` |
| Draft confirmation, duplicate protection, undo | `transaction-confirmation.ts`, `duplicate-detector.ts` |
| JSON repositories and file-level lock | `transaction-repositories.ts`, `conversation-repository.ts` |
| Summary/recent transaction formatting | `transaction-summary.ts`, `telegram-command-formatters.ts` |
| Telegram copy, locale, keyboards | `src/bot/messages`, `src/bot/keyboards`, `user-preferences.ts` |

## Persistence and integrity

Local files are created under `LOCAL_DATA_DIRECTORY` (default `./data`) for
drafts, confirmed transactions, conversation state, and user preferences.
They are development records, not a database.

- Scope active conversation state by both `telegramUserId` and
  `telegramChatId`; a reply in one chat must not change another chat's draft.
- A draft is `pending`, `confirmed`, or `cancelled`. Only `pending` drafts can
  be changed or confirmed.
- Confirmation validates required fields and serializes actions per draft to
  make rapid callbacks/retries idempotent.
- Detect likely duplicates before saving. **Save anyway** requires a second
  explicit action.
- Undo voids, rather than deletes, a confirmed record within the configured
  window. Recent lists and summaries exclude voided transactions.
- Never automatically delete a corrupt JSON file. Stop the bot and inspect or
  back it up first.

## Safe extension pattern

When adding an input type, command, draft field, or callback:

1. Update/validate the schema and pure feature-layer rule first.
2. Extend repository behavior and tests if persistence changes.
3. Add localized copy and keyboard behavior where needed.
4. Wire the feature into `telegram-bot.ts` with ownership checks, safe error
   handling, and temporary-file cleanup for media.
5. Add tests for happy path, malformed/stale callback, cross-user or cross-chat
   access, repeated callback, and provider/storage failure where applicable.

Never convert model output into a confirmed record without the explicit review
and confirmation boundary.
