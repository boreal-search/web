# Boreal Search — web

The web app for Boreal Search: sign in, see the document collections your organisation can
access, and search them. Results are the matching PDF pages themselves, shown beside a short
generated summary whose every sentence cites, and is checked against, the page it came from.

This repo is a thin shell. Ingestion, embeddings and retrieval run in a separate, private
engine service that the app calls server-side only; this app handles accounts, who may search
what, and the UI.

## Features

- **Search** — streaming results with page previews, a cited summary with per-sentence check
  status, follow-up questions that refine a search into a trail, and links that open the PDF
  at the cited page.
- **Data sources** — browse the collections and documents available in your current context.
- **Organisations** — members, invites, roles and per-org data source access. People without
  an org search the public collections and can request access for their organisation.
- **Admin** — platform administrators manage orgs and public collections, review searches
  (filters, ratings, JSON export) and users.
- Light and dark themes, keyboard-friendly, responsive down to phone width.

## Stack

SvelteKit · Svelte 5 (runes) · TypeScript · Supabase (Auth and Postgres with row-level
security) · Tailwind v4 (theme tokens) · Vitest · bun · deployed on Vercel.

## Local setup

```sh
mise install            # bun + node versions from mise.toml (or install bun yourself)
bun install
cp .env.example .env    # then fill in the values described there
bun run dev
```

`.env.example` lists every variable: the Supabase project URL and anon key, the engine URL and
service token, and optional email and file-link settings. Without a reachable engine the app
still runs; pages that need it show a notice.

The database schema lives in `supabase/migrations`. Apply it to your own Supabase project with
the Supabase CLI (`supabase link`, then `supabase db push`). Policy tests are pgTAP:
`supabase start && supabase test db`. Platform administrators are granted in SQL, not in the UI.

## Commands

| Command                             | What                                           |
| ----------------------------------- | ---------------------------------------------- |
| `bun run dev`                       | dev server                                     |
| `bun run check`                     | type-check (`svelte-check`)                    |
| `bun run lint` / `bun run format`   | prettier + eslint                              |
| `bun run test`                      | unit tests (vitest)                            |
| `bun run build` / `bun run preview` | production build; preview it locally           |
| `bun run gen:engine-client`         | regenerate the engine API types                |
| `bun run gen:supabase-types`        | regenerate the Supabase `Database` types       |
| `bun run shots`                     | screenshots of pages (Playwright, test logins) |

## More

- `docs/ui.md` — UI rules: colour roles, type, answer states.
- `docs/decisions.md` — why things are the way they are.
- `CLAUDE.md` — layout and conventions for working in this repo.
