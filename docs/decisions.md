# Decisions

Short, dated records of choices that aren't obvious from the code. Newest first.

## 2026-10-20 — `wrangler types` output is generated, not committed

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

Free tier with no cold starts; Render's free web services sleep after 15 minutes. The Worker
runtime is not Node, which is fine because this app is a thin shell (auth + proxy + UI).
Deployed with `adapter-cloudflare` + `wrangler`.
