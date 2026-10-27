-- Product analytics for our own use: one row per search the web app forwards to the engine.
-- Written by the search action after the engine responds (success or failure). Everything an
-- insights page or a retrieval-quality review needs is derivable from this table.

-- Per-org switch for storing raw query text. Enterprise customers may not want their queries
-- retained; with it off we still record length/latency/result counts, just not the text.
alter table public.orgs
    add column log_queries boolean not null default true;

create type public.search_status as enum ('ok', 'forbidden', 'engine_error');

create table public.search_events (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references public.orgs (id) on delete cascade,
    user_id         uuid references public.profiles (id) on delete set null,
    data_source_ids text[] not null,
    query           text,                      -- null when orgs.log_queries is false
    query_length    integer not null,
    top_k           integer not null,
    rerank          boolean not null,
    status          public.search_status not null,
    result_count    integer,                   -- null unless status = 'ok'
    top_score       real,                      -- null when no results
    retrieval_ms    integer,                   -- engine-reported; null on error
    reranked        boolean,
    error           text,                      -- engine error detail; never includes the token
    created_at      timestamptz not null default now()
);
create index search_events_org_created_idx on public.search_events (org_id, created_at desc);
create index search_events_created_idx on public.search_events (created_at desc);

alter table public.search_events enable row level security;

-- Members can write events for their own org and read their org's history. Updates/deletes
-- are service-role only: this is an audit-ish log.
create policy "search_events: insert own org" on public.search_events
    for insert to authenticated
    with check (public.is_org_member(org_id) and user_id = (select auth.uid()));

create policy "search_events: read own org" on public.search_events
    for select to authenticated
    using (public.is_org_member(org_id));

-- Daily rollup per org. security_invoker so RLS on search_events still applies to readers.
create view public.org_search_daily
with (security_invoker = true) as
select
    org_id,
    date_trunc('day', created_at)::date                    as day,
    count(*)                                               as searches,
    count(*) filter (where status = 'ok')                  as ok,
    count(*) filter (where status = 'engine_error')        as engine_errors,
    count(*) filter (where status = 'ok' and result_count = 0) as zero_result,
    count(distinct user_id)                                as active_users,
    percentile_cont(0.5) within group (order by retrieval_ms) as p50_retrieval_ms,
    percentile_cont(0.95) within group (order by retrieval_ms) as p95_retrieval_ms
from public.search_events
group by org_id, day;
