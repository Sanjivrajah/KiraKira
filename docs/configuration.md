# Configuration

Configuration is split by runtime. Vercel receives web and server-route values; Railway receives the Telegram worker values. A value needed by both services must be configured independently on both platforms.

## Web and Supabase

| Variable | Required | Runtime | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_AUTH_MODE` | Recommended | Browser and server | `supabase` by default; `demo` enables the explicit browser-local adapter |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase mode | Vercel and Railway | Supabase project API URL—the name is public, but Railway also uses it server-side |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase mode | Vercel | Browser-safe Supabase publishable or anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted jobs and Supabase bot mode | Vercel and Railway | Bypasses RLS; restricted to trusted server and worker code |

Do not use the service-role key as proof that an actor is allowed to perform an operation. The Railway worker resolves the linked Telegram account and active business membership before it uses trusted database functions.

## OpenAI

| Variable | Required | Runtime | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | For AI extraction | Vercel and Railway | Server-side OpenAI credential |
| `OPENAI_VISION_MODEL` | Optional | Vercel | Receipt-image extraction; defaults to `gpt-5.4` |
| `OPENAI_DOCUMENT_MODEL` | Optional | Vercel | PDF bank-statement extraction; falls back to the vision model |
| `OPENAI_TEXT_MODEL` | Optional | Vercel | Structures a transaction after web voice transcription |
| `OPENAI_TRANSACTION_MODEL` | Telegram worker | Railway | Telegram text and transcript extraction; the example uses `gpt-4o-mini` |

OpenAI extraction returns proposals. It never owns confirmation or persistence.

## ElevenLabs

| Variable | Required | Runtime | Purpose |
| --- | --- | --- | --- |
| `ELEVENLABS_API_KEY` | For voice features | Vercel and Railway | Speech-to-text and browser conversational token requests |
| `ELEVENLABS_STT_MODEL` | Optional | Vercel and Railway | Transcription model; defaults to `scribe_v2` |
| `ELEVENLABS_AGENT_ID` | Browser voice assistant | Vercel | Private Conversational AI agent used by `/api/voice/session` |
| `MAX_VOICE_FILE_BYTES` | Optional | Railway | Telegram voice-note limit; defaults to 20 MiB |

The browser receives a short-lived ElevenLabs conversation token—not the API key or agent secret configuration.

## Telegram worker

| Variable | Required | Runtime | Purpose |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Yes | Railway | BotFather token used by grammY |
| `BOT_PERSISTENCE_MODE` | Yes in deployment | Railway | Use `supabase` on Railway; `local` is for development and demos |
| `LOCAL_DATA_DIRECTORY` | Local mode only | Railway or local shell | Directory for JSON drafts, records, state, preferences, and traces |

Railway uses `npm run bot:start` from `railway.toml`. The process polls Telegram and does not need a public HTTP port.

## MyInvois

| Variable | Required | Runtime | Purpose |
| --- | --- | --- | --- |
| `MYINVOIS_SANDBOX_API_BASE_URL` | Sandbox | Vercel | Sandbox document API base URL |
| `MYINVOIS_SANDBOX_IDENTITY_BASE_URL` | Sandbox | Vercel | Sandbox OAuth base URL |
| `MYINVOIS_SANDBOX_CLIENT_ID` | Sandbox | Vercel | Active sandbox OAuth client ID |
| `MYINVOIS_SANDBOX_CLIENT_SECRET` | Sandbox | Vercel | Active sandbox OAuth client secret |
| `MYINVOIS_PRODUCTION_API_BASE_URL` | Production | Vercel | Production document API base URL |
| `MYINVOIS_PRODUCTION_IDENTITY_BASE_URL` | Production | Vercel | Production OAuth base URL |
| `MYINVOIS_PRODUCTION_CLIENT_ID` | Production | Vercel | Production OAuth client ID when the connection points to this reference |
| `MYINVOIS_PRODUCTION_CLIENT_SECRET` | Production | Vercel | Production OAuth client secret when the connection points to this reference |
| `EINVOICE_STATUS_SYNC_SECRET` | Status worker | Vercel and scheduler | High-entropy bearer secret for the internal reconciliation endpoint |

MyInvois connections persist opaque references such as `env:sandbox:MYINVOIS_SANDBOX_CLIENT_SECRET`. The value itself remains in the Vercel environment. Production references must use the `env:production:...` scope and a separately managed credential pair.

## Safe handling

- Only the three `NEXT_PUBLIC_` values may enter browser bundles.
- Keep production, preview, and development values separate in Vercel.
- Keep Railway variables service-scoped—do not expose the bot token or service-role key to build logs.
- Rotate a leaked credential at the provider first, then update the platform environment and redeploy or restart the affected runtime.
- Never log uploaded evidence, raw transcripts, unsigned MyInvois payloads, bearer tokens, or provider response bodies.

Variables that are not read by the current code are intentionally absent from `.env.example`. Add a variable only when an implemented runtime path consumes it, and document it here in the same change.
