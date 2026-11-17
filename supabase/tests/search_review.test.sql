-- pgTAP: search_ratings RLS (own ratings, reviewer verdicts, trail ratings), idempotent re-rating,
-- and the search_review view. Everything rolls back.
begin;
select plan(17);

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test', now()),
    ('00000000-0000-0000-0000-00000000000c', 'owner@acme.test',   now()),
    ('00000000-0000-0000-0000-00000000000d', 'peer@acme.test',    now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orgs (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'acme', 'Acme');
insert into public.org_members (org_id, user_id, role) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'member');
insert into public.trails (id, org_id, user_id, title) values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-00000000000c', 'Chinook habitat');
insert into public.search_events
    (id, org_id, user_id, data_source_ids, query, query_length, top_k, rerank, status, trail_id, step_n)
values
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-00000000000c', '{acme-docs}', 'chinook', 7, 10, true, 'ok',
     '20000000-0000-0000-0000-000000000001', 1);

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

-- ---------------------------------------------------------------- the searcher
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'bad', 'wrong page') $$,
    'the searcher rates their search');
select lives_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'good') $$,
    're-rating the same search');
select is((select count(*)::int from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001' or trail_id = '20000000-0000-0000-0000-000000000001'), 1, 're-rating replaces: one row');
select is((select rating::text || coalesce(note, '-') from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001'), 'good-',
    're-rating replaces the rating and the note');
select lives_ok($$ select pg_temp.rate(null, '20000000-0000-0000-0000-000000000001', 'good') $$,
    'the owner rates the whole trail');
select throws_ok($$ insert into public.search_ratings (search_event_id, trail_id, rating)
                    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'good') $$,
    '23514', null, 'a rating has exactly one target');
select throws_ok($$ insert into public.search_ratings (search_event_id, user_id, rating) values
                    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'bad') $$,
    '42501', null, 'no rating on behalf of someone else');

-- ---------------------------------------------------------------- a peer in the same org
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'bad') $$,
    '42501', null, 'a peer cannot rate someone else''s search');
select throws_ok($$ select pg_temp.rate(null, '20000000-0000-0000-0000-000000000001', 'bad') $$,
    '42501', null, 'a peer cannot rate someone else''s trail');
select is((select count(*)::int from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001' or trail_id = '20000000-0000-0000-0000-000000000001'), 0, 'a peer reads no one else''s ratings');
select is((select user_rating::text from public.search_review where id = '30000000-0000-0000-0000-000000000001'),
    null, 'the review view hides the searcher''s rating from a peer');

-- ---------------------------------------------------------------- platform admin (reviewer)
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001' or trail_id = '20000000-0000-0000-0000-000000000001'), 2, 'a platform admin reads every rating');
select lives_ok($$ select pg_temp.rate('30000000-0000-0000-0000-000000000001', null, 'bad', 'cites the wrong volume') $$,
    'a platform admin records a reviewer verdict');
select throws_ok($$ select pg_temp.rate(null, '20000000-0000-0000-0000-000000000001', 'bad') $$,
    '42501', null, 'trails are rated by their owner only');
select results_eq(
    $$ select user_email, org_name, user_rating::text, trail_rating::text, review_rating::text, review_note, reviewer_email
       from public.search_review where id = '30000000-0000-0000-0000-000000000001' $$,
    $$ values ('owner@acme.test', 'Acme', 'good', 'good', 'bad', 'cites the wrong volume', 'admin@boreal.test') $$,
    'the review row has the searcher''s ratings and the reviewer''s verdict apart');

-- ---------------------------------------------------------------- clearing
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ delete from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001' $$,
    'the searcher clears their rating');
reset role;
select is((select count(*)::int from public.search_ratings where search_event_id = '30000000-0000-0000-0000-000000000001'), 1,
    'clearing removes only the searcher''s own rating, not the verdict');

select * from finish();
rollback;
