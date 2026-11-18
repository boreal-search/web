-- pgTAP: search_ratings is platform-admin only (rate any search or trail, read all, one row per
-- target and admin, re-rating replaces); users and org admins neither rate nor read ratings; the
-- search_review view. Everything rolls back.
begin;
select plan(33);

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test',    now()),
    ('00000000-0000-0000-0000-00000000000b', 'orgadmin@acme.test',   now()),
    ('00000000-0000-0000-0000-00000000000c', 'owner@acme.test',      now()),
    ('00000000-0000-0000-0000-00000000000e', 'admin2@boreal.test',   now());
insert into public.platform_admins (user_id) values
    ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e');
insert into public.orgs (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'acme', 'Acme');
insert into public.org_members (org_id, user_id, role) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'admin'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member');
insert into public.trails (id, org_id, user_id, title) values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-00000000000c', 'Chinook habitat');
insert into public.search_events
    (id, org_id, user_id, data_source_ids, query, query_length, top_k, rerank, status, trail_id, step_n)
values
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-00000000000c', '{acme-docs}', 'chinook', 7, 10, true, 'ok',
     '20000000-0000-0000-0000-000000000001', 1);
update public.search_events set answer = '{"text":"secret"}', resolved_query = 'chinook habitat'
    where id = '30000000-0000-0000-0000-000000000001';

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;

-- Upsert as the app does: one row per (target, user).
create function pg_temp.rate(p_event uuid, p_trail uuid, p_rating public.search_rating, p_note text default null)
returns void language sql as $$
    insert into public.search_ratings (search_event_id, trail_id, rating, note)
    values (p_event, p_trail, p_rating, p_note)
    on conflict (search_event_id, trail_id, user_id)
    do update set rating = excluded.rating, note = excluded.note, updated_at = now();
$$;

-- Counts as postgres (no RLS), scoped to this test's rows.
create function pg_temp.ratings() returns int language sql security definer as $$
    select count(*)::int from public.search_ratings
    where search_event_id = '30000000-0000-0000-0000-000000000001'
       or trail_id = '20000000-0000-0000-0000-000000000001';
$$;

-- ---------------------------------------------------------------- the searcher (a member)
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'bad') $$,
    '42501', null, 'a user cannot rate their own search');
select throws_ok($$ select pg_temp.rate(null, '20000000-0000-0000-0000-000000000001', 'good') $$,
    '42501', null, 'a user cannot rate their own trail');

-- ---------------------------------------------------------------- an org admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.search_events where id = '30000000-0000-0000-0000-000000000001'), 0,
    'an org admin cannot read a member''s search (or its answer)');
select is((select count(*)::int from public.search_review where id = '30000000-0000-0000-0000-000000000001'), 0,
    'nor through search_review');
select throws_ok($$ insert into public.search_events (org_id, user_id, data_source_ids, query_length, top_k, rerank, status, trail_id)
                    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '{x}', 1, 10, true, 'ok',
                            '20000000-0000-0000-0000-000000000001') $$,
    '42501', null, 'a search cannot name someone else''s trail');
select throws_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'bad') $$,
    '42501', null, 'an org admin cannot rate their org''s searches');

-- ---------------------------------------------------------------- platform admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'bad', 'wrong page') $$,
    'a platform admin rates any search');
select lives_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'good') $$,
    'and rates it again');
select is(pg_temp.ratings(), 1, 're-rating replaces: one row');
select is((select rating::text || coalesce(note, '-') from public.search_ratings
           where search_event_id = '30000000-0000-0000-0000-000000000001'), 'good-',
    're-rating replaces the rating and the note');
select lives_ok($$ select pg_temp.rate(null, '20000000-0000-0000-0000-000000000001', 'bad', 'drifts') $$,
    'a platform admin rates a whole trail');
select throws_ok($$ insert into public.search_ratings (search_event_id, trail_id, rating)
                    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'good') $$,
    '23514', null, 'a rating has exactly one target');
select throws_ok($$ insert into public.search_ratings (search_event_id, user_id, rating) values
                    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'bad') $$,
    '42501', null, 'no rating on behalf of another admin');
select results_eq(
    $$ select user_email, org_name, rating::text, rated_by, trail_rating::text, trail_note
       from public.search_review where id = '30000000-0000-0000-0000-000000000001' $$,
    $$ values ('owner@acme.test', 'Acme', 'good', 'admin@boreal.test', 'bad', 'drifts') $$,
    'the review row has the latest rating of the search and of its trail');

-- ---------------------------------------------------------------- another platform admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.search_ratings
           where search_event_id = '30000000-0000-0000-0000-000000000001'), 1,
    'platform admins read each other''s ratings');
select lives_ok($$ delete from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001' $$,
    'deleting another admin''s rating runs');
select is(pg_temp.ratings(), 2, 'but removes nothing: admins clear only their own');

-- ---------------------------------------------------------------- the searcher's trail is deleted mid-stream
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ insert into public.search_events (id, org_id, user_id, data_source_ids, query_length, top_k, rerank, status, trail_id, step_n)
                   values ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001',
                           '00000000-0000-0000-0000-00000000000c', '{x}', 1, 10, true, 'ok',
                           '20000000-0000-0000-0000-000000000099', 2) $$,
    'a search naming a trail that no longer exists is still recorded');
select is((select count(*)::int from public.search_events where id = '30000000-0000-0000-0000-000000000001'), 1,
    'the searcher reads their own search');

-- ---------------------------------------------------------------- reading as non-admins
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.search_ratings), 0, 'a user reads no ratings');
select is((select rating::text from public.search_review where id = '30000000-0000-0000-0000-000000000001'),
    null, 'the review view shows a member no rating');
select is((select count(*)::int from public.search_review
           where trail_rating is not null or trail_note is not null), 0,
    'nor any trail rating (what the admin table and its CSV export filter on)');
select is((select count(*)::int from public.search_review
           where user_id is distinct from '00000000-0000-0000-0000-00000000000c'), 0,
    'and only their own searches');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.search_review where user_email = 'owner@acme.test'), 0,
    'an org admin reads none of a member''s searches through the view');

-- ---------------------------------------------------------------- clearing
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ delete from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001' $$,
    'a platform admin clears their rating');
reset role;
select is(pg_temp.ratings(), 1, 'only the search rating is gone; the trail rating stays');

-- ---------------------------------------------------------------- conversation rows
-- A rated trail none of whose searches is linked gets its own row; T2 is the admin's own, T3 a
-- member's (rated by the admin, as RLS allows).
insert into public.trails (id, org_id, user_id, title) values
    ('20000000-0000-0000-0000-000000000002', null, '00000000-0000-0000-0000-00000000000a', 'Caribou range'),
    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-00000000000c', 'Member question');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.rate(null, '20000000-0000-0000-0000-000000000002', 'bad', 'wrong herd');
select pg_temp.rate(null, '20000000-0000-0000-0000-000000000003', 'good');
select results_eq(
    $$ select kind, user_email, query, trail_rating::text, trail_note, status::text
       from public.search_review where trail_id = '20000000-0000-0000-0000-000000000002' $$,
    $$ values ('conversation', 'admin@boreal.test', 'Caribou range', 'bad', 'wrong herd', null::text) $$,
    'an unlinked rated trail appears once, as a conversation row, to its owner');
select results_eq(
    $$ select kind, user_id, query, trail_rating::text
       from public.search_review where trail_id = '20000000-0000-0000-0000-000000000003' $$,
    $$ values ('conversation', null::uuid, null::text, 'good') $$,
    'another user''s rated trail appears with its rating only: the trail stays private');
select is((select count(*)::int from public.search_review where kind = 'conversation'
           and trail_id = '20000000-0000-0000-0000-000000000001'), 0,
    'a trail with a linked search has no conversation row');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.search_review where kind = 'conversation'), 0,
    'a member sees no conversation rows, not even of their own rated trail');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.search_review where kind = 'conversation'), 0,
    'nor does an org admin');

-- A search names T2: the rating moves onto it and the conversation row goes.
reset role;
insert into public.search_events (id, org_id, user_id, data_source_ids, query, query_length, top_k, rerank, status, trail_id, step_n)
values ('30000000-0000-0000-0000-000000000002', null, '00000000-0000-0000-0000-00000000000a',
        '{x}', 'Caribou range', 13, 10, true, 'ok', '20000000-0000-0000-0000-000000000002', 1);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.search_review where kind = 'conversation'
           and trail_id = '20000000-0000-0000-0000-000000000002'), 0,
    'once a search is linked, the conversation row is gone');
select results_eq(
    $$ select kind, trail_rating::text from public.search_review where trail_id = '20000000-0000-0000-0000-000000000002' $$,
    $$ values ('search', 'bad') $$,
    'and the rating shows on the search instead: listed once');
reset role;

select * from finish();
rollback;
