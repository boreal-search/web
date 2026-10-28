-- pgTAP: trails, trail_shares, trail_steps RLS; conversation_history; step records. Everything rolls back.
begin;
select plan(31);

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test',  now()),
    ('00000000-0000-0000-0000-00000000000b', 'orgadmin@acme.test', now()),
    ('00000000-0000-0000-0000-00000000000c', 'owner@acme.test',    now()),
    ('00000000-0000-0000-0000-00000000000d', 'peer@acme.test',     now()),
    ('00000000-0000-0000-0000-00000000000e', 'nobody@public.test', now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orgs (id, slug, name, conversation_history) values
    ('10000000-0000-0000-0000-000000000001', 'acme',  'Acme',  true),
    ('10000000-0000-0000-0000-000000000002', 'quiet', 'Quiet', false);
insert into public.org_members (org_id, user_id, role) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'admin'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'member'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'member');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;

create function pg_temp.step(p_trail uuid, p_query text, p_builds_on int default null) returns int language sql as $$
    insert into public.trail_steps (trail_id, n, query, resolved_query, scope, builds_on, results, readout)
    values (p_trail, 0, p_query, p_query, '{"data_source_ids":["acme-docs"]}', p_builds_on, '[]', '{}')
    returning n;
$$;

select col_default_is('public', 'orgs', 'conversation_history', 'true', 'orgs keep search history by default');

-- ---------------------------------------------------------------- owner
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ insert into public.trails (id, org_id, title) values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Chinook habitat') $$,
    'owner starts a trail in an org that keeps history');
select lives_ok($$ insert into public.trails (id, org_id, title) values
    ('20000000-0000-0000-0000-000000000002', null, 'Public trail') $$,
    'owner starts a trail in the Public context');
select throws_ok($$ insert into public.trails (org_id, title) values ('10000000-0000-0000-0000-000000000002', 'x') $$,
    '42501', null, 'no trail in an org with conversation_history off');
select throws_ok($$ insert into public.trails (org_id, user_id, title) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'x') $$,
    '42501', null, 'no trail on behalf of another user');
select is(pg_temp.step('20000000-0000-0000-0000-000000000001', 'first'), 1, 'step numbers start at 1');
select is(pg_temp.step('20000000-0000-0000-0000-000000000001', 'second', 1), 2, 'step numbers are assigned in order');
select throws_ok($$ select pg_temp.step('20000000-0000-0000-0000-000000000001', 'bad', 3) $$,
    '23514', null, 'a step builds only on an earlier step');
select ok((select updated_at > created_at or updated_at = now() from public.trails
           where id = '20000000-0000-0000-0000-000000000001'), 'a new step bumps the trail''s updated_at');
select lives_ok($$ update public.trail_steps set answer = '{"text":"x"}', readout = '{"total_ms":1}'
                   where trail_id = '20000000-0000-0000-0000-000000000001' and n = 2 $$,
    'owner completes a step with its summary and readout');
select throws_ok($$ update public.trail_steps set answer = '{"text":"y"}'
                    where trail_id = '20000000-0000-0000-0000-000000000001' and n = 2 $$,
    '42501', null, 'a recorded summary is never rewritten');
select throws_ok($$ update public.trail_steps set query = 'edited'
                    where trail_id = '20000000-0000-0000-0000-000000000001' and n = 1 $$,
    '42501', null, 'a step''s query is never rewritten');
select lives_ok($$ insert into public.trail_shares (trail_id, user_id) values
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d') $$,
    'owner shares with a member of the trail''s org');
select throws_ok($$ insert into public.trail_shares (trail_id, user_id) values
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e') $$,
    '42501', null, 'owner cannot share with someone outside the org');
select throws_ok($$ insert into public.trail_shares (trail_id, user_id) values
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d') $$,
    '42501', null, 'a Public-context trail cannot be shared');
select results_eq($$ select email, relation from public.trail_people('20000000-0000-0000-0000-000000000001') order by relation, email $$,
    $$ values ('orgadmin@acme.test', 'member'), ('owner@acme.test', 'owner'), ('peer@acme.test', 'shared') $$,
    'owner sees who it is shared with and who it could be shared with');

-- ---------------------------------------------------------------- shared-with member
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select results_eq($$ select title from public.trails $$, $$ values ('Chinook habitat') $$,
    'a member reads a trail shared with them, and no other');
select is((select count(*)::int from public.trail_steps), 2, 'a member reads the shared trail''s steps');
select throws_ok($$ select pg_temp.step('20000000-0000-0000-0000-000000000001', 'mine') $$,
    '42501', null, 'a shared trail is read-only: no new steps');
update public.trails set title = 'renamed';
delete from public.trail_steps;
delete from public.trail_shares;
select results_eq($$ select title from public.trails $$, $$ values ('Chinook habitat') $$,
    'a member cannot rename the shared trail');
select is((select count(*)::int from public.trail_steps), 2, 'a member cannot delete its steps');
select is((select count(*)::int from public.trail_shares), 1, 'a member cannot remove a share');
select results_eq($$ select relation, count(*)::int from public.trail_people('20000000-0000-0000-0000-000000000001') group by relation order by relation $$,
    $$ values ('owner', 1), ('shared', 1) $$, 'a viewer sees the owner and shares, not candidates');

-- ---------------------------------------------------------------- org admin, platform admin, outsider
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.trails), 0, 'org admins do not read members'' trails');
select is((select count(*)::int from public.trail_people('20000000-0000-0000-0000-000000000001')), 0,
    'org admins get no names for a trail they cannot read');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.trails), 0, 'platform admins do not read trails');
select is((select count(*)::int from public.trail_steps), 0, 'platform admins do not read steps');

-- ---------------------------------------------------------------- history turned off later
reset role;
update public.orgs set conversation_history = false where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select pg_temp.step('20000000-0000-0000-0000-000000000001', 'third') $$,
    '42501', null, 'no new steps once the org stops keeping history');
select is((select count(*)::int from public.trail_steps), 2, 'owner still reads their stored steps');
delete from public.trails where id = '20000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.trails), 1, 'owner deletes a trail, even with history off');
reset role;
select is((select count(*)::int from public.trail_steps where trail_id = '20000000-0000-0000-0000-000000000001'), 0,
    'deleting a trail deletes its steps');

select * from finish();
rollback;
