-- Link searches recorded before 20261116000001 to their trail steps, so ratings of older trails
-- (search_review attaches a trail rating only through search_events.trail_id) and of their
-- steps (the search screen finds a step's search by (trail_id, step_n)) show up.
--
-- A step is stored when its results arrive and its search is recorded when the stream ends,
-- so the search follows the step by well under the 180 s summary deadline. A wrong link is
-- worse than a missing one, so a pair is linked only when each is the other's only candidate:
-- same user, context, query text, data sources, result count and an ok outcome, the search
-- within 4 minutes after the step. The rules for new rows hold here too: only searches whose
-- text was kept, in contexts that still keep it (orgs.log_queries), and only fields still empty
-- are filled from the step (as searched, summary, result locators, time taken). Odd old jsonb
-- (missing keys, wrong types) means no match or a null, never an error. Idempotent; a function
-- so supabase/tests can exercise it. Returns how many searches it linked.
create function public.link_old_searches_to_trails()
returns integer
language sql
set search_path = ''
as $$
    with step as (
        select s.trail_id, s.n, s.query, s.resolved_query, s.answer, s.results, s.created_at,
               t.user_id, t.org_id,
               case when jsonb_typeof(s.results) = 'array' then jsonb_array_length(s.results) end
                   as result_count,
               case when jsonb_typeof(s.scope -> 'data_source_ids') = 'array' then
                   array(select jsonb_array_elements_text(s.scope -> 'data_source_ids') order by 1)
               end as data_source_ids,
               case when jsonb_typeof(s.readout -> 'search' -> 'total_ms') = 'number' then
                   round((s.readout -> 'search' ->> 'total_ms')::numeric)::int
               end as total_ms
        from public.trail_steps s
        join public.trails t on t.id = s.trail_id
        left join public.orgs o on o.id = t.org_id
        where (t.org_id is null or o.log_queries)
          and not exists (
              select 1 from public.search_events x where x.trail_id = s.trail_id and x.step_n = s.n
          )
    ),
    candidate as (
        select s.*, e.id as event_id,
               count(*) over (partition by s.trail_id, s.n) as step_candidates,
               count(*) over (partition by e.id) as event_candidates
        from step s
        join public.search_events e
          on e.user_id = s.user_id
         and e.org_id is not distinct from s.org_id
         and e.trail_id is null
         and e.status = 'ok'
         and e.query = s.query
         and e.result_count = s.result_count
         and array(select unnest(e.data_source_ids) order by 1) = s.data_source_ids
         and e.created_at >= s.created_at
         and e.created_at < s.created_at + interval '4 minutes'
    ),
    linked as (
        update public.search_events e
        set trail_id       = c.trail_id,
            step_n         = c.n,
            resolved_query = coalesce(e.resolved_query, c.resolved_query),
            answer         = coalesce(e.answer, c.answer),
            results        = coalesce(e.results, c.results),
            total_ms       = coalesce(e.total_ms, c.total_ms)
        from candidate c
        where e.id = c.event_id and c.step_candidates = 1 and c.event_candidates = 1
        returning 1
    )
    select count(*)::int from linked;
$$;
revoke all on function public.link_old_searches_to_trails() from public, anon, authenticated;

select public.link_old_searches_to_trails();
