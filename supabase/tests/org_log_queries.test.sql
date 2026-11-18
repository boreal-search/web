-- pgTAP: orgs.log_queries is on by default; org admins and platform admins switch it, members can't.
begin;
select plan(6);

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test',  now()),
    ('00000000-0000-0000-0000-00000000000b', 'orgadmin@acme.test', now()),
    ('00000000-0000-0000-0000-00000000000c', 'member@acme.test',   now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orgs (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'acme', 'Acme');
insert into public.org_members (org_id, user_id, role) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'admin'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;
create function pg_temp.logs() returns boolean language sql security definer as $$
    select log_queries from public.orgs where id = '10000000-0000-0000-0000-000000000001';
$$;

select ok(pg_temp.logs(), 'a new org keeps queries and answers for review by default');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.set_org_log_queries('10000000-0000-0000-0000-000000000001', false) $$,
    '42501', null, 'a member cannot switch it');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.set_org_log_queries('10000000-0000-0000-0000-000000000001', false) $$,
    'an org admin turns it off');
select ok(not pg_temp.logs(), 'off is stored');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_org_log_queries('10000000-0000-0000-0000-000000000001', true) $$,
    'a platform admin turns it back on');
select ok(pg_temp.logs(), 'on is stored');

select * from finish();
rollback;
