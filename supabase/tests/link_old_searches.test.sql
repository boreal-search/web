-- pgTAP: link_old_searches_to_trails (20261118000001) links a search to its trail step only when
-- each is the other's only candidate, copies what the step kept, skips contexts with
-- log_queries off, survives odd old jsonb, and links nothing on a second run. Rolls back.
begin;
select plan(13);

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-0000000000f1', 'old-searcher@acme.test', now());
insert into public.orgs (id, slug, name, log_queries) values
    ('10000000-0000-0000-0000-0000000000f1', 'keeps', 'Keeps', true),
    ('10000000-0000-0000-0000-0000000000f2', 'stopped', 'Stopped', false);
insert into public.org_members (org_id, user_id, role) values
    ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'member'),
    ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'member');

-- Steps as stored before 20261116000001, at fixed times (the insert trigger would set now()).
set local session_replication_role = replica;
insert into public.trails (id, org_id, user_id, title) values
    ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'clean'),
    ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'overlap A'),
    ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'overlap B'),
    ('20000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'stopped'),
    ('20000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'other source'),
    ('20000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'odd jsonb');

create function pg_temp.step(p_trail uuid, p_query text, p_at timestamptz,
                             p_scope jsonb default '{"data_source_ids":["acme-docs"]}',
                             p_results jsonb default '[{"rank":1},{"rank":2}]',
                             p_readout jsonb default '{"search":{"total_ms":1234.6}}')
returns void language sql as $$
    insert into public.trail_steps (trail_id, n, query, resolved_query, scope, results, answer, readout, created_at)
    values (p_trail, 1, p_query, p_query || ' (as searched)', p_scope, p_results,
            '{"text":"kept summary"}', p_readout, p_at);
$$;
select pg_temp.step('20000000-0000-0000-0000-0000000000a1', 'clean', '2026-01-01 00:00:00+00');
select pg_temp.step('20000000-0000-0000-0000-0000000000a2', 'overlap', '2026-01-02 00:00:00+00');
select pg_temp.step('20000000-0000-0000-0000-0000000000a3', 'overlap', '2026-01-02 00:00:50+00');
select pg_temp.step('20000000-0000-0000-0000-0000000000a4', 'stopped', '2026-01-03 00:00:00+00');
select pg_temp.step('20000000-0000-0000-0000-0000000000a5', 'other source', '2026-01-04 00:00:00+00');
select pg_temp.step('20000000-0000-0000-0000-0000000000a6', 'odd', '2026-01-05 00:00:00+00',
                    '{"data_source_ids":["acme-docs"]}', '[{"rank":1},{"rank":2}]', '{"search":null}');
set local session_replication_role = origin;

create function pg_temp.event(p_id uuid, p_org uuid, p_query text, p_at timestamptz, p_sources text[] default '{acme-docs}')
returns void language sql as $$
    insert into public.search_events (id, org_id, user_id, data_source_ids, query, query_length, top_k, rerank, status, result_count, created_at)
    values (p_id, p_org, '00000000-0000-0000-0000-0000000000f1', p_sources, p_query, length(p_query), 10, true, 'ok', 2, p_at);
$$;
select pg_temp.event('30000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000f1', 'clean', '2026-01-01 00:00:00.2+00');
-- One user, one query, two trails, overlapping streams: S_A 0 s, S_B 50 s, E_A 60 s, E_B 100 s.
select pg_temp.event('30000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000f1', 'overlap', '2026-01-02 00:01:00+00');
select pg_temp.event('30000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000f1', 'overlap', '2026-01-02 00:01:40+00');
-- Text kept while log_queries was on; the org has turned it off since.
select pg_temp.event('30000000-0000-0000-0000-0000000000e4', '10000000-0000-0000-0000-0000000000f2', 'stopped', '2026-01-03 00:00:00.2+00');
select pg_temp.event('30000000-0000-0000-0000-0000000000e5', '10000000-0000-0000-0000-0000000000f1', 'other source', '2026-01-04 00:00:00.2+00', '{other-docs}');
select pg_temp.event('30000000-0000-0000-0000-0000000000e6', '10000000-0000-0000-0000-0000000000f1', 'odd', '2026-01-05 00:00:00.2+00');

create function pg_temp.link_of(p_id uuid) returns text language sql as $$
    select coalesce(trail_id::text || '/' || step_n, 'none') from public.search_events where id = p_id;
$$;

select lives_ok($$ select public.link_old_searches_to_trails() $$, 'the backfill runs');

select is(pg_temp.link_of('30000000-0000-0000-0000-0000000000e1'), '20000000-0000-0000-0000-0000000000a1/1',
    'a search with one candidate step is linked to it');
select results_eq(
    $$ select resolved_query, answer ->> 'text', results is not null, total_ms
       from public.search_events where id = '30000000-0000-0000-0000-0000000000e1' $$,
    $$ values ('clean (as searched)', 'kept summary', true, 1235) $$,
    'and gets what the step kept (fractional total_ms rounded)');

select is(pg_temp.link_of('30000000-0000-0000-0000-0000000000e2'), 'none',
    'overlapping streams of one query: the first search is not linked');
select is(pg_temp.link_of('30000000-0000-0000-0000-0000000000e3'), 'none',
    'nor the second');

select is(pg_temp.link_of('30000000-0000-0000-0000-0000000000e4'), 'none',
    'a context with log_queries off is not linked');
select results_eq(
    $$ select resolved_query, answer, results, total_ms
       from public.search_events where id = '30000000-0000-0000-0000-0000000000e4' $$,
    $$ values (null::text, null::jsonb, null::jsonb, null::int) $$,
    'and gets none of the step''s content');

select is(pg_temp.link_of('30000000-0000-0000-0000-0000000000e5'), 'none',
    'a search over other data sources is not linked');

select is(pg_temp.link_of('30000000-0000-0000-0000-0000000000e6'), '20000000-0000-0000-0000-0000000000a6/1',
    'a step without a search readout still links');
select is((select total_ms from public.search_events where id = '30000000-0000-0000-0000-0000000000e6'), null,
    'with no time taken');

create temp table before_second as select * from public.search_events;
select is(public.link_old_searches_to_trails(), 0, 'a second run links nothing');
select is((select count(*)::int from public.search_events e join before_second b using (id)
           where (e.trail_id, e.step_n, e.answer, e.total_ms) is distinct from (b.trail_id, b.step_n, b.answer, b.total_ms)), 0,
    'and changes nothing');

select is(has_function_privilege('authenticated', 'public.link_old_searches_to_trails()', 'execute'), false,
    'users cannot run it');

select * from finish();
rollback;
