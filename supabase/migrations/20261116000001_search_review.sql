-- Search review: founders read what was searched and what came back, and mark answers good or bad.
--   search_events gains what the user saw (as searched, the summary, the result locators) and,
--     when the step was stored, where it is in its trail. The text columns follow
--     orgs.log_queries like `query`: off = null. The trail tables stay owner-only; the review
--     reads search_events, so platform admins see queries and answers where log_queries is on.
--   search_ratings: platform admins only for now (a dev tool). One rating per (target, admin);
--     the target is a search (one response) or a whole trail (the conversation). Opening it to
--     users means widening these policies and `canRate` in src/lib/server/ratings.ts.
--   search_review: the admin table's rows, with the latest rating of the search and its trail.
--   Reading search_events: now that rows hold answers, members read only their own searches
--     (was: their whole org's); platform admins still read all. Nothing in the app read other
--     members' rows; org_search_daily (invoker) now rolls up only what the reader can see.
--   The trail tables stay private to their owner; the same queries and answers reach Boreal's
--     review through search_events while log_queries is on (docs/decisions.md, 2026-11-16).

alter table public.search_events
    -- No foreign key: a trail deleted while its search streams must not stop the search being
    -- recorded. Null with log_queries off. The insert policy below checks the caller owns it.
    add column trail_id       uuid,
    add column step_n         int check (step_n is null or step_n >= 1),
    add column resolved_query text,      -- null when orgs.log_queries is false
    add column answer         jsonb,     -- the summary as shown; null without one or with log_queries off
    add column results        jsonb,     -- result locators (no signed URLs); null with log_queries off
    add column total_ms       integer;   -- the whole search, engine-reported; null on failure
create index search_events_trail_idx on public.search_events (trail_id, step_n) where trail_id is not null;

drop policy "search_events: read own org" on public.search_events;

create policy "search_events: read own" on public.search_events
    for select to authenticated
    using (user_id = (select auth.uid()));

-- A search may name a trail unless it is someone else's. A trail that no longer exists (deleted
-- while its search streamed) is allowed, so the search is still recorded.
create function public.may_name_trail(p_trail_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select not exists (
        select 1 from public.trails t where t.id = p_trail_id and t.user_id <> (select auth.uid())
    );
$$;
revoke all on function public.may_name_trail(uuid) from public;
grant execute on function public.may_name_trail(uuid) to authenticated;

-- On top of the insert policies (own org / Public).
create policy "search_events: own trail only" on public.search_events
    as restrictive
    for insert to authenticated
    with check (trail_id is null or public.may_name_trail(trail_id));

create type public.search_rating as enum ('good', 'bad');

create table public.search_ratings (
    search_event_id uuid references public.search_events (id) on delete cascade,
    trail_id        uuid references public.trails (id) on delete cascade,
    user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    rating          public.search_rating not null,
    note            text check (char_length(note) between 1 and 1000),
    updated_at      timestamptz not null default now(),
    check (num_nonnulls(search_event_id, trail_id) = 1),
    -- Exactly one target is set, so this is one rating per (target, user); upserts conflict on it.
    unique nulls not distinct (search_event_id, trail_id, user_id)
);
create index search_ratings_trail_idx on public.search_ratings (trail_id) where trail_id is not null;

alter table public.search_ratings enable row level security;

create policy "search_ratings: admins read" on public.search_ratings
    for select to authenticated
    using (public.is_platform_admin());

create policy "search_ratings: admins rate" on public.search_ratings
    for insert to authenticated
    with check (public.is_platform_admin() and user_id = (select auth.uid()));

create policy "search_ratings: admins re-rate their own" on public.search_ratings
    for update to authenticated
    using (public.is_platform_admin() and user_id = (select auth.uid()))
    with check (public.is_platform_admin() and user_id = (select auth.uid()));

create policy "search_ratings: admins clear their own" on public.search_ratings
    for delete to authenticated
    using (public.is_platform_admin() and user_id = (select auth.uid()));

-- One row per search for /admin/searches. security_invoker: RLS on every table still applies,
-- so only platform admins see all rows, emails and ratings.
create view public.search_review
with (security_invoker = true) as
select
    e.id, e.created_at, e.org_id, o.name as org_name, e.user_id, p.email as user_email,
    e.query, e.query_length, e.resolved_query, e.data_source_ids, e.status, e.error,
    e.result_count, e.retrieval_ms, e.total_ms, e.trail_id, e.step_n, e.answer, e.results,
    r.rating, r.note, r.email as rated_by,
    t.rating as trail_rating, t.note as trail_note
from public.search_events e
left join public.orgs o on o.id = e.org_id
left join public.profiles p on p.id = e.user_id
left join lateral (
    select x.rating, x.note, xp.email
    from public.search_ratings x left join public.profiles xp on xp.id = x.user_id
    where x.search_event_id = e.id
    order by x.updated_at desc
    limit 1
) r on true
left join lateral (
    select x.rating, x.note
    from public.search_ratings x
    where e.trail_id is not null and x.trail_id = e.trail_id
    order by x.updated_at desc
    limit 1
) t on true;
