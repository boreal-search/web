# Decisions

Short, dated records of choices that aren't obvious from the code. Newest first.

## 2026-10-28 — Platform admins, owner-managed members, invites and domain auto-join

Roles: platform admin (`platform_admins`, global), org `owner`, org `member`. Admins do
everything; owners add/remove members and invites in their org (and may grant `owner`, so
ownership can be handed over); members only search. An org always keeps one owner while users
manage it (`keep_last_owner` trigger; admins and SQL sessions are exempt).

Enforced in Postgres with RLS and one security-definer RPC, `add_org_member(org, email, role)`:
an existing account becomes a member, any other email an `org_invites` row; calling it again
changes the role. The web keeps the anon key + user session, so a bug in a route can't exceed
what the user may do, and there is no service-role key to leak from Vercel. Routes still guard
(`requirePlatformAdmin`, `requireOrgManager`) to give a 403 instead of a silent no-op.

Invites and `org_domains` auto-join (with `orgs.default_role`) are claimed in
`handle_new_user` only once the email is confirmed, so signing up as someone else's address
claims nothing. Domains apply to new sign-ups only; existing users are added by email.

Seats are membership rows; per-seat pricing later = count `org_members` (a cap would be
`orgs.seat_limit`, checked in `add_org_member` and the auto-join). One session per seat is
Supabase Auth's "single session per user" setting (Pro plan), not code.

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
