# boreal-search/web

Public SvelteKit dashboard for Boreal Search. Auth, org → data-source access, search UI.
It is a thin shell: all corpora, vectors and search logic live in the private `engine`
service, reached server-side only. Contract: `boreal-search/infra/docs/architecture.md`.

## Stack

SvelteKit 3 · Svelte 5 (runes only) · TypeScript strict · bun · Cloudflare Workers
(`adapter-cloudflare`) · Supabase (Auth + control-plane Postgres via `@supabase/ssr`) · vitest.

## Commands

```
bun install                 # deps (mise provides bun/node)
bun run dev                 # vite dev, reads .env
bun run check               # wrangler types + svelte-check (must be 0 errors)
bun run lint                # prettier --check + eslint
bun run format              # prettier --write
bun run test                # vitest --run
bun run build               # cloudflare build
bun run preview             # wrangler dev on the built worker (reads .dev.vars)
bun run deploy              # build + wrangler deploy
bun run gen:engine-client   # regen src/lib/server/engine.openapi.ts from $ENGINE_URL/openapi.json (curl w/ token, .env); engine.types.ts = aliases
bun run gen:supabase-types  # regen src/lib/supabase/types.ts (needs `supabase link`)
supabase migration new <name> && supabase db push   # schema changes live in supabase/migrations
```

## Layout

- `src/env.ts` — declared env vars (`defineEnvVars`); import from `$app/env/private|public`.
- `src/hooks.server.ts` — Supabase client + validated session on `locals`.
- `src/lib/server/` — server-only: `engine.ts` (API client), `access.ts` (org ↔ data source checks), `analytics.ts` (search_events), `auth.ts`.
- `src/lib/supabase/` — SSR client factory and hand-written `Database` types.
- `src/routes/(app)/` — authenticated pages; `+layout.server.ts` guards and loads `accessibleDataSourceIds`.
- `supabase/migrations/` — control-plane schema with RLS.

## Conventions

- Engine calls only from `src/lib/server/**` or `+page.server.ts`/`+server.ts`. `ENGINE_SERVICE_TOKEN` never reaches the browser.
- Every search/data-source request re-checks org access (`findForbiddenDataSources`); never trust ids from the client.
- Every search records a `search_events` row (ok / forbidden / engine_error). Keep that when changing the search path.
- Svelte 5 runes (`$state`, `$derived`, `$props`), `PageProps`/`LayoutProps` types, `resolve()` from `$app/paths` for internal links, `rel="external"` for signed engine `/files/` URLs.
- `#lib/...` imports use a `.js` extension (`#lib/server/engine.js`). No `any`. Keep markup semantic; design pass is a separate effort.
- Supabase schema changes = new migration file + update `src/lib/supabase/types.ts`.

## How to work here

The main session is the orchestrator. Plan briefly, then delegate: non-trivial features to
`implementer` (opus), small/mechanical edits to `quick-implementer` (sonnet). Review the diff
yourself (or via `reviewer`), then run `bun run check && bun run lint && bun run test`
before reporting. For `.svelte` files use the `svelte` skill / autofixer when available.
Decisions and context: `docs/`.
