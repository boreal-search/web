-- Search review: founders read what was searched and what came back, and mark answers good or bad.
--   search_events gains what the user saw (as searched, the summary, the result locators) and,
--     when the step was stored, where it is in its trail. The text columns follow
--     orgs.log_queries like `query`: off = null. The trail tables stay owner-only; the review
--     reads search_events, so platform admins see queries and answers where log_queries is on.
--   search_ratings: one rating per (target, user); the target is a search (one response) or a
--     whole trail (the conversation). Users rate their own; platform admins rate any search as
--     reviewers (a row by someone other than the searcher is a reviewer verdict) and read all.
--   search_review: the admin table's rows, with the searcher's rating and the latest verdict.

alter table public.search_events
    add column trail_id       uuid references public.trails (id) on delete set null,
    add column step_n         int check (step_n is null or step_n >= 1),
    add column resolved_query text,      -- null when orgs.log_queries is false
    add column answer         jsonb,     -- the summary as shown; null without one or with log_queries off
    add column results        jsonb,     -- result locators (no signed URLs); null with log_queries off
    add column total_ms       integer;   -- the whole search, engine-reported; null on failure
create index search_events_trail_idx on public.search_events (trail_id, step_n) where trail_id is not null;

-- The search screen finds the search behind each of a trail's steps, in any context (members
-- read their org's searches already; Public-context ones were admin-only).
create policy "search_events: read own" on public.search_events
    for select to authenticated
    using (user_id = (select auth.uid()));

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

-- The caller ran this search.
create or replace function public.owns_search_event(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.search_events e where e.id = p_id and e.user_id = (select auth.uid())
    );
$$;
revoke all on function public.owns_search_event(uuid) from public;
grant execute on function public.owns_search_event(uuid) to authenticated;

alter table public.search_ratings enable row level security;

create policy "search_ratings: read own, admins all" on public.search_ratings
    for select to authenticated
    using (user_id = (select auth.uid()) or public.is_platform_admin());

-- Searches: the searcher, or a platform admin reviewing. Trails: the owner only.
create policy "search_ratings: rate own or review" on public.search_ratings
    for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and case
            when search_event_id is not null
                then public.owns_search_event(search_event_id) or public.is_platform_admin()
            else public.owns_trail(trail_id)
        end
    );

create policy "search_ratings: re-rate own" on public.search_ratings
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (
        user_id = (select auth.uid())
        and case
            when search_event_id is not null
                then public.owns_search_event(search_event_id) or public.is_platform_admin()
            else public.owns_trail(trail_id)
        end
    );

create policy "search_ratings: clear own" on public.search_ratings
    for delete to authenticated
    using (user_id = (select auth.uid()));

-- One row per search for /admin/searches. security_invoker: RLS on every table still applies,
-- so only platform admins see all rows, emails and ratings.
create view public.search_review
with (security_invoker = true) as
select
    e.id, e.created_at, e.org_id, o.name as org_name, e.user_id, p.email as user_email,
    e.query, e.query_length, e.resolved_query, e.data_source_ids, e.status, e.error,
    e.result_count, e.retrieval_ms, e.total_ms, e.trail_id, e.step_n, e.answer, e.results,
    ur.rating as user_rating, ur.note as user_note,
    tr.rating as trail_rating, tr.note as trail_note,
    rv.rating as review_rating, rv.note as review_note, rv.email as reviewer_email
from public.search_events e
left join public.orgs o on o.id = e.org_id
left join public.profiles p on p.id = e.user_id
left join public.search_ratings ur on ur.search_event_id = e.id and ur.user_id = e.user_id
left join public.search_ratings tr on tr.trail_id = e.trail_id and tr.user_id = e.user_id
left join lateral (
    select r.rating, r.note, rp.email
    from public.search_ratings r left join public.profiles rp on rp.id = r.user_id
    where r.search_event_id = e.id and r.user_id is distinct from e.user_id
    order by r.updated_at desc
    limit 1
) rv on true;
