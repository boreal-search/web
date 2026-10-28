# Boreal Search — web

Dashboard for [Boreal Search](https://github.com/boreal-search): log in, see the data sources
your organisation can access, and run visual search over them. Results are page images with
a link into the source PDF.

This app is a thin shell on Vercel. Corpora, embeddings and search run in the
private `engine` service; this repo only handles auth, org → data-source access, and the UI.

## Local setup

```sh
mise install                       # bun + node from mise.toml
bun install
cp .env.example .env               # vite dev / preview read .env
# fill in PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY from your Supabase project,
# ENGINE_URL / ENGINE_SERVICE_TOKEN from the engine you're pointing at
bun run dev
```

Supabase schema (once per project):

```sh
supabase login
supabase link --project-ref <ref>
supabase db push                   # applies supabase/migrations
```

Grant an org access to a data source (until there's an admin UI, do it in SQL):

```sql
insert into orgs (slug, name) values ('acme', 'Acme Environmental');
insert into org_members (org_id, user_id, role)
  select id, '<auth.users.id>', 'owner' from orgs where slug = 'acme';
insert into org_data_sources (org_id, data_source_id)
  select id, 'bc-regs' from orgs where slug = 'acme';
```

## Scripts

| Command                             | What                                                    |
| ----------------------------------- | ------------------------------------------------------- |
| `bun run dev`                       | dev server                                              |
| `bun run check`                     | type-check (`svelte-check`)                             |
| `bun run lint` / `bun run format`   | prettier + eslint                                       |
| `bun run test`                      | vitest                                                  |
| `bun run build` / `bun run preview` | Vercel build (`.vercel/output`); `vite preview`         |
| `bun run deploy`                    | `vercel deploy --prod` (pushes to `main` also deploy)   |
| `bun run gen:engine-client`         | regenerate engine types from `$ENGINE_URL/openapi.json` |
| `bun run gen:supabase-types`        | regenerate Supabase `Database` types                    |

## Deploy

Vercel Hobby project linked to this repo (pushes to `main` deploy production, PRs get
preview URLs). Set env vars in the Vercel dashboard or with the CLI, for Production and Preview:

```sh
bun x vercel login && bun x vercel link
for v in PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY ENGINE_URL ENGINE_SERVICE_TOKEN \
         RESEND_API_KEY EMAIL_FROM; do
  bun x vercel env add $v production
done
bun run deploy                     # optional manual deploy; git push is the normal path
```

`RESEND_API_KEY` / `EMAIL_FROM` (`Boreal Search <no-reply@borealsearch.app>`) are optional; without
them `sendEmail` throws. Magic-link emails are sent by Supabase: set Auth → SMTP Settings to
`smtp.resend.com:465`, user `resend`, password = a Resend API key.

Add the deployed origin (`https://<project>.vercel.app/auth/confirm`, plus the custom domain) to
the Supabase project's Auth → Redirect URLs.

## More

- `CLAUDE.md` — conventions and how to work in this repo.
- `docs/decisions.md` — why things are the way they are.
- Architecture and API contract: `boreal-search/infra/docs/architecture.md`.
