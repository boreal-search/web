# boreal-search/web

Public SvelteKit dashboard for Boreal Search. Auth, org → data-source access, search UI.
It is a thin shell: all corpora, vectors and search logic live in the private `engine`
service, reached server-side only. Contract: `boreal-search/infra/docs/architecture.md`.

## Stack

SvelteKit 3 · Svelte 5 (runes only) · TypeScript strict · bun · Vercel Hobby
(`adapter-vercel`, Node) · Supabase (Auth + control-plane Postgres via `@supabase/ssr`) · Resend · vitest.

## Commands

```
bun install                 # deps (mise provides bun/node)
bun run dev                 # vite dev, reads .env
bun run check               # svelte-check (must be 0 errors)
bun run lint                # prettier --check + eslint
bun run format              # prettier --write
bun run test                # vitest --run
bun run build               # vercel build → .vercel/output
bun run preview             # vite preview (reads .env)
bun run deploy              # vercel deploy --prod (git push to main also deploys)
bun run gen:engine-client   # regen src/lib/server/engine.openapi.ts from $ENGINE_URL/openapi.json (curl w/ token, .env); engine.types.ts = aliases
bun run gen:supabase-types  # regen src/lib/supabase/types.ts (needs `supabase link`)
supabase migration new <name> && supabase db push   # schema changes live in supabase/migrations
```

## Layout

- `src/env.ts` — declared env vars (`defineEnvVars`); import from `$app/env/private|public`.
- `src/hooks.server.ts` — Supabase client + validated session on `locals`.
- `src/lib/server/` — server-only: `engine.ts` (API client, timeouts, failure kinds), `access.ts` (`getAccess`: the one place deciding what a user may search), `analytics.ts` (search_events), `auth.ts` (session + platform/org admin guards), `orgs.ts` (org-management input parsing, invite email), `email.ts` (Resend; app emails only).
- `src/lib/supabase/` — SSR client factory and hand-written `Database` types.
- `src/routes/(app)/` — authenticated pages; `+layout.server.ts` guards and loads `inOrg` + `accessibleDataSourceIds`. `admin/` (platform admins), `orgs/[slug]/manage/` (org admin page; platform admins see extra sections). Roles: platform admin / org admin / member (`src/lib/roles.ts`).
- `supabase/migrations/` — control-plane schema with RLS; roles in `*_admin_roles.sql` + `*_org_admin_and_search_outcomes.sql`. `supabase/tests/` — pgTAP (`supabase test db`).

## Conventions

- Engine calls only from `src/lib/server/**` or `+page.server.ts`/`+server.ts`. `ENGINE_SERVICE_TOKEN` never reaches the browser.
- Every search/data-source request re-checks org access (`findForbiddenDataSources`); never trust ids from the client.
- Every search records a `search_events` row (ok / forbidden / timeout / unreachable / unavailable / engine_error). Keep that when changing the search path.
- Svelte 5 runes (`$state`, `$derived`, `$props`), `PageProps`/`LayoutProps` types, `resolve()` from `$app/paths` for internal links, `rel="external"` for signed engine `/files/` URLs.
- `#lib/...` imports use a `.js` extension (`#lib/server/engine.js`). No `any`. Keep markup semantic; design pass is a separate effort.
- Supabase schema changes = new migration file + update `src/lib/supabase/types.ts`.
- Authorization lives in RLS/RPCs with the user's session; no service-role key in the app.

## How to work here

Guidance, not hard rules (adapted from Lauren Tan's pstack):

- **Subtract first.** Smallest change; prefer deletion, remove dead weight before building on it.
- **Data structures first.** Settle core types and shared state before logic. Redesign as if a
  new requirement had always been there. Eliminate sharing before serializing it.
- **Model the domain** in types, not scattered conditionals. Guard at boundaries, trust internal
  types, keep logic pure, make operations idempotent.
- **Converge, don't bridge.** Migrate callers and delete the old API in the same change.
- **Minimize reader load.** Fewer layers between question and answer; collapse one-caller wrappers.
- **Experience first.** Fewer, polished features. For open design questions, compare 2–3 prototypes.
- **Root causes.** Fix where it first went wrong; after two failed fixes on one premise, test it.
- **Prove it** on the real artifact, not "it compiles". Small units that each end verified; tests
  assert observable behavior; explain a measured number before trusting it.
- **Build the lever.** A script, codemod, lint or skill beats hand work or more prose.
- **Delegate bulk, don't block.** The main session orchestrates and keeps summaries: non-trivial
  work to `implementer` (opus), small/mechanical to `quick-implementer` (sonnet), second reads to
  `reviewer`. Proceed and let the user course-correct; confirm only irreversible actions.

Verify: `bun run check && bun run lint && bun run test`, then the real page in `bun run dev`.
For `.svelte` files use the `svelte` skill / autofixer. Decisions and context: `docs/`.
