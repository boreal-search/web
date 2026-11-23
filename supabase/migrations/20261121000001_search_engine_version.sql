-- Which engine answered, for grouping feedback by engine (agent-chat #4), and the engine's plan
-- for a multi-part question (agent-chat #5), for the review and its JSON export.
--   engine_version: the engine's own label ("2.0"); null on failure or from an older engine.
--   plan: the engine's `plan`, as sent; null without one. Holds the facets' query text, so it
--     follows orgs.log_queries like `query`: off = null.
--   search_review gains both, appended so the existing columns keep their positions.

alter table public.search_events
    add column engine_version text check (char_length(engine_version) between 1 and 64),
    add column plan           jsonb;

create or replace view public.search_review
with (security_invoker = true) as
select
    e.id, e.created_at, e.org_id, o.name as org_name, e.user_id, p.email as user_email,
    e.query, e.query_length, e.resolved_query, e.data_source_ids, e.status, e.error,
    e.result_count, e.retrieval_ms, e.total_ms, e.trail_id, e.step_n, e.answer, e.results,
    r.rating, r.note, r.email as rated_by,
    t.rating as trail_rating, t.note as trail_note,
    'search'::text as kind,
    e.engine_version, e.plan
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
) t on true
union all
select
    r.trail_id, r.updated_at, tr.org_id, o.name, tr.user_id, p.email,
    tr.title, coalesce(char_length(tr.title), 0), null, '{}'::text[], null::public.search_status, null,
    null, null, null, r.trail_id, null, null, null,
    null, null, rp.email,
    r.rating, r.note,
    'conversation',
    null, null
from (
    select distinct on (x.trail_id) x.trail_id, x.rating, x.note, x.updated_at, x.user_id
    from public.search_ratings x
    where x.trail_id is not null
    order by x.trail_id, x.updated_at desc
) r
left join public.trails tr on tr.id = r.trail_id
left join public.orgs o on o.id = tr.org_id
left join public.profiles p on p.id = tr.user_id
left join public.profiles rp on rp.id = r.user_id
where not exists (select 1 from public.search_events e where e.trail_id = r.trail_id);
