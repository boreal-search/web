-- Link searches recorded before 20261116000001 to their trail steps, so ratings of older trails
-- (search_review attaches a trail rating only through search_events.trail_id) and of their
-- steps (the search screen finds a step's search by (trail_id, step_n)) show up.
--
-- A step is stored when its results arrive and its search is recorded when the stream ends,
-- so the search follows the step by well under the 180 s summary deadline. A pair is linked
-- only when it is unambiguous: the same user, context, query text, result count and an ok
-- outcome; the search within 4 minutes after the step; and each is the other's nearest
-- candidate. The rules for new rows hold here too: only searches whose text was kept, in
-- contexts that still keep it (orgs.log_queries), and only fields still empty are filled from
-- the step (as searched, summary, result locators, time taken). Runs once; re-running links
-- nothing new.
with candidate as (
    select s.trail_id, s.n, e.id as event_id, e.created_at - s.created_at as gap
    from public.trail_steps s
    join public.trails t on t.id = s.trail_id
    left join public.orgs o on o.id = t.org_id
    join public.search_events e
      on e.user_id = t.user_id
     and e.org_id is not distinct from t.org_id
     and e.trail_id is null
     and e.status = 'ok'
     and e.query = s.query
     and e.result_count = jsonb_array_length(s.results)
     and e.created_at >= s.created_at
     and e.created_at < s.created_at + interval '4 minutes'
    where (t.org_id is null or o.log_queries)
      and not exists (
          select 1 from public.search_events x where x.trail_id = s.trail_id and x.step_n = s.n
      )
),
ranked as (
    select c.*,
           row_number() over (partition by c.trail_id, c.n order by c.gap, c.event_id) as step_rank,
           row_number() over (partition by c.event_id order by c.gap, c.trail_id, c.n) as event_rank
    from candidate c
)
update public.search_events e
set trail_id       = s.trail_id,
    step_n         = s.n,
    resolved_query = coalesce(e.resolved_query, s.resolved_query),
    answer         = coalesce(e.answer, s.answer),
    results        = coalesce(e.results, s.results),
    total_ms       = coalesce(e.total_ms, (s.readout -> 'search' ->> 'total_ms')::int)
from ranked r
join public.trail_steps s on s.trail_id = r.trail_id and s.n = r.n
where e.id = r.event_id and r.step_rank = 1 and r.event_rank = 1;
