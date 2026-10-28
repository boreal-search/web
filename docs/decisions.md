# Decisions

Short, dated records of choices that aren't obvious from the code. Newest first.

## 2026-10-29 — Public tier and current org

Migration `20261029000001_public_tier_and_current_org`. `public_data_sources (data_source_id)`
lists corpora every signed-in user may search, with no org and no seat (readable by
`authenticated`; insert/delete platform admins only; managed in the "Public corpora" section of
`/admin`, saved with `planGrantChanges` like org grants). Search without login stays out.

A user can be in several orgs, so a search now runs in an explicit **current context**: one of
their orgs, or Public. It is stored per device in the `boreal_org` cookie (org slug or `public`)
and re-validated on every request in `getAccess` (`src/lib/server/access.ts`), still the only
place access is decided: `availableContexts` = their orgs by name, then Public (offered when public
corpora exist; always for a user with no org); `resolveContext` takes the cookie's context if it is
in that list, else the first. A forged cookie only ever falls back. The searchable set is the
current org's grants ∪ public corpora (`searchableGroups`, grouped "<Org name>" / "Public"; a
corpus that is both is listed once, under Public). In Public only public corpora count. The
dashboard, the picker, the data-source page and the search action all use that one set, and the
search action re-checks posted ids against it. The nav switcher (a no-JS form POST to
`/switch-org`) shows when there are 2+ contexts; with 2+ orgs and no public corpora it omits Public
rather than offer an empty choice. A user with no org lands in Public instead of a dead end
("Want your own documents? Contact us."), or a clear empty state when nothing is public.

`resolveSearchOrg` (guessing the org from the requested ids) is gone. Searches are logged with
`org_id` = the current org (its `log_queries` applies), or `org_id = null` with the query text in
Public. `search_events.org_id` is nullable; a new insert policy allows `org_id is null and user_id =
auth.uid()`. Members' policies call `is_org_member(org_id)`, false for null, so they never see
Public rows; a new "admin read" policy lets platform admins read every event (they had none
before). `org_search_daily` is unchanged: Public searches roll up into an `org_id = null` row that
only platform admins can see.

## 2026-10-28 — Password sign-up, reset and change (requires "Confirm email" ON)

> **Security requirement:** password sign-up is only safe with **Auth → Providers → Email →
> Confirm email ON** in the hosted project. Invites and `org_domains` auto-joins are claimed
> when the email is confirmed; with confirmation off, anyone could sign up as
> `someone@customer.com` and be dropped into that org. The app does not detect this setting.

`/signup` (email + password), `/forgot` → email → `/account/password`, and `/account` (change
password with the current one). Rules: at least 8 characters (`MIN_PASSWORD_LENGTH`, same as
`minimum_password_length`), at most 72 bytes (bcrypt), confirmation must match; validated
server-side in `src/lib/server/credentials.ts`. Supabase errors map to fixed messages there.

No account enumeration: `/forgot` always says "if an account exists…"; `/signup` shows "check
your email" for a taken address too. Supabase only returns a decoy user for a taken address
when no autoconfirm is on (local SMS autoconfirm already breaks that), and its per-address
email cooldown answers 429 only for real accounts, so both forms treat
`user_already_exists`/`email_exists`/`over_email_send_rate_limit` as success (`revealsAccount`).
Cost: when the project-wide email limit is hit, people are told a link was sent when it wasn't.
Login says "Invalid email or password." for both unknown emails and wrong passwords.

Change password re-verifies with `signInWithPassword` on the request's client before
`updateUser`. That also gives a fresh session, which `secure_password_change` (password updates
need a session under 24h old or a nonce) accepts. Magic-link users without a password use
/forgot to set one.

Reset without the current password: the recovery email links to `/auth/confirm?token_hash=…
&type=recovery`, which passes the unused token to `/account/password?token_hash=…`; that page
calls `verifyOtp` only when the new password is submitted, then `updateUser`. The one-time token
is the proof, and it is spent on the action it authorizes. Measured locally: a session from
`verifyOtp` on a recovery token has AMR `otp`, the same as a magic link, so the AMR can't
mark a recovery there, and an unsigned "recovery" cookie could be set by anyone holding a
stolen session. Supabase's default PKCE link (`?code=`) does produce AMR `recovery`, so a
session with a `recovery` AMR under 15 minutes old (`hasRecentRecovery`, JWT checked via
`getClaims`) is also accepted. That keeps the stock template working.

Email templates (`supabase/templates/`) build `{{ .RedirectTo }}&token_hash=…`, so links
return to whichever origin asked (production, vercel.app) and keep `next`. They fall back to
`{{ .SiteURL }}/auth/confirm?next=…` when Supabase replaced the redirect with the Site URL.
Redirect allow-list entries need a `**` suffix: an exact `…/auth/confirm` entry doesn't match
`…/auth/confirm?next=/` (checked locally), and Supabase then silently uses the Site URL.

## 2026-10-28 — Search outcomes: timeouts and failure kinds

Engine calls time out (`ENGINE_TIMEOUT_MS` in `engine.ts`: 8 s reads, 12 s search, 25 s search
with an answer). Failures are classified once (`classifyEngineError`): `timeout`;
`unreachable` (network error or the tunnel's 502/504/530: workstation off); `unavailable` (503:
Qdrant/Ollama down); `error` (anything else). A 200 with no results is `no_results`, not an
error. Each kind has its own message (`engineFailureMessage`), shared by the search page, the
dashboard and the data-source page. The answer is optional: if the answer request fails for any
reason but `unreachable`, the search is retried without it and the page says why there is no
answer (400 = no LLM on the engine; timeout; other).

`search_events.status` (an enum) gained `timeout`, `unreachable`, `unavailable`; other engine
errors stay `engine_error`, and `org_search_daily.engine_errors` counts all four. A missing
answer on an `ok` search is noted in `error` (`answer failed: timeout`, `answer disabled`).
Enum values over a free-text field so failure rates are a `group by`, not a string parse.

## 2026-10-28 — Platform admins, org admins, invites and domain auto-join

One vocabulary everywhere (schema, code, UI): **platform admin** (`platform_admins`, global),
**org admin** (`org_role` `admin`), **member**. The role was first called `owner`; migration
`20261028000002` renames the enum value and replaces `is_org_owner`/`keep_last_owner` with
`is_org_admin`/`keep_last_admin`, no shims. Platform admins do everything; org admins add/remove
members and invites in their org (and may grant `admin`, so the role can be handed over);
members only search. An org always keeps one org admin while users manage it
(`keep_last_admin` trigger; platform admins and SQL sessions are exempt). The org admin page
is `/orgs/[slug]/manage`; data source grants, email domains and org settings are platform admin
only. Domain auto-join refuses public mail providers (`isPublicEmailDomain`), since claiming
`gmail.com` would let anyone in.

Public tier: built 2026-10-29 (see "Public tier and current org"). Public users aren't seats;
seats stay `org_members` rows.

Enforced in Postgres with RLS and one security-definer RPC, `add_org_member(org, email, role)`:
an existing account becomes a member, any other email an `org_invites` row; calling it again
changes the role. The web keeps the anon key + user session, so a bug in a route can't exceed
what the user may do, and there is no service-role key to leak from Vercel. Routes still guard
(`requirePlatformAdmin`, `requireOrgAdmin`) to give a 403 instead of a silent no-op.

Invites and `org_domains` auto-join (with `orgs.default_role`) are claimed in
`handle_new_user` only once the email is confirmed, so signing up as someone else's address
claims nothing. Domains apply to newly confirmed addresses (sign-ups and email changes);
existing users are added by email.

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
