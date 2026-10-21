# Docs

- `decisions.md` — dated ADR-lite log for this repo.
- System architecture, the engine API contract, env var names and the data-ownership split live
  in the infra repo: `boreal-search/infra/docs/architecture.md`. Update that first when the
  contract changes, then regenerate `src/lib/server/engine.types.ts`.
