# Decisions

Short, dated records of choices that aren't obvious from the code. Newest first.

## 2026-10-27 — Vercel Hobby over Cloudflare Workers

Supersedes "Cloudflare Workers over Render" (2026-10-20). Deployed with `adapter-vercel` on the
Node runtime; git pushes deploy, PRs get previews. Analytics inserts use `waitUntil` from
`@vercel/functions` (awaited off-Vercel). Hobby is for non-commercial use, so this is a
prototype choice: revisit (Vercel Pro at $20/mo, or back to Workers) before Boreal is commercial.
App emails go through Resend (`src/lib/server/email.ts`); Supabase auth emails use Resend SMTP.

## 2026-10-20 — `wrangler types` output is generated, not committed

_Obsolete since 2026-10-27 (no more wrangler)._

`worker-configuration.d.ts` bakes in whichever var names exist in the local `.env`/`.dev.vars`,
so `wrangler types --check` is flaky across machines. `check`/`build` regenerate it instead,
and it is gitignored. `allowJs` is off so its `typeof import("./.svelte-kit/cloudflare/_worker")`
doesn't pull the built JS into svelte-check.

## 2026-10-20 — Server-only engine proxy

The browser never talks to the engine. `src/lib/server/engine.ts` holds the bearer token and
every route re-checks `org_data_sources` before forwarding `data_source_ids`. The engine trusts
the token; authorization is this app's responsibility.

## 2026-10-20 — Supabase Auth with email magic link

No OAuth client to configure, works for any company email during demos, and the Supabase
project already hosts the control-plane tables. Switching to Google later is auth config,
not code. Sessions are validated with `auth.getUser()` in `hooks.server.ts`, not just the cookie.

## 2026-10-20 — Cloudflare Workers over Render

_Superseded 2026-10-27 by "Vercel Hobby over Cloudflare Workers"._

Free tier with no cold starts; Render's free web services sleep after 15 minutes. The Worker
runtime is not Node, which is fine because this app is a thin shell (auth + proxy + UI).
Deployed with `adapter-cloudflare` + `wrangler`.

## 2026-10-21 — Product analytics live in Supabase (`search_events`)

Every search writes one row (org, user, data sources, query, result count, top score,
latency, status) via `src/lib/server/analytics.ts`, after the engine responds and through
`waitUntil` (Workers then, Vercel now) so it never slows the request. `orgs.log_queries` lets an org opt out of
raw query text (length is still kept). `org_search_daily` is the first rollup view; insights
pages read from it. No third-party analytics vendor — this is for our own retrieval-quality
and usage review, and zero-result queries are the signal Daud needs most.
