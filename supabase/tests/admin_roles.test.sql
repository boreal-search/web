-- pgTAP: roles, add_org_member, invite/domain claims and RLS. Run with `supabase test db`
-- against a local stack (`supabase start`). Everything rolls back.
begin;
select plan(37);

-- Fixtures (as postgres, bypassing RLS).
insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test', now()),
    ('00000000-0000-0000-0000-00000000000b', 'owner@acme.test',   now()),
    ('00000000-0000-0000-0000-00000000000c', 'member@acme.test',  now()),
    ('00000000-0000-0000-0000-00000000000d', 'x@other.test',      now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orgs (id, slug, name) values
    ('10000000-0000-0000-0000-000000000001', 'acme', 'Acme'),
    ('10000000-0000-0000-0000-000000000002', 'other', 'Other');
insert into public.org_members (org_id, user_id, role) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'owner'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;

-- ---------------------------------------------------------------- owner
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select ok(not public.is_platform_admin(), 'owner is not a platform admin');
select ok(public.is_org_owner('10000000-0000-0000-0000-000000000001'), 'owner owns acme');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', ' New@Acme.TEST ', 'member'),
    'invited', 'unknown email → invite');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'new@acme.test', 'owner'),
    'invited', 'invite is idempotent and updates the role');
select results_eq($$ select email, role::text from public.org_invites $$,
    $$ values ('new@acme.test', 'owner') $$, 'one lower-cased invite, owners can read it');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'X@other.test', 'member'),
    'added', 'existing account → member');
select is((select count(*)::int from public.profiles), 3, 'owner reads their members'' profiles only');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000002', 'a@b.test', 'member') $$,
    '42501', null, 'owner cannot add to another org');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'not-an-email', 'member') $$,
    '22023', null, 'invalid email rejected');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'owner@acme.test', 'member') $$,
    '23514', null, 'last owner cannot demote themselves');
select throws_ok($$ delete from public.org_members where user_id = '00000000-0000-0000-0000-00000000000b' $$,
    '23514', null, 'last owner cannot remove themselves');
select throws_ok($$ insert into public.org_invites (org_id, email) values ('10000000-0000-0000-0000-000000000001', 'direct@acme.test') $$,
    '42501', null, 'owners write invites only through add_org_member');
select throws_ok($$ insert into public.org_data_sources (org_id, data_source_id) values ('10000000-0000-0000-0000-000000000001', 'ds') $$,
    '42501', null, 'owners cannot grant corpora');
select throws_ok($$ insert into public.org_domains (org_id, domain) values ('10000000-0000-0000-0000-000000000001', 'acme.test') $$,
    '42501', null, 'owners cannot add domains');
update public.orgs set log_queries = false where slug = 'acme';
select is((select log_queries from public.orgs where slug = 'acme'), true, 'owners cannot change org settings');
select is((select count(*)::int from public.orgs), 1, 'owner sees only their org');
delete from public.org_members where user_id = '00000000-0000-0000-0000-00000000000d';
select is((select count(*)::int from public.org_members where user_id = '00000000-0000-0000-0000-00000000000d'),
    0, 'owner removes a member');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'member@acme.test', 'owner'),
    'added', 'owner promotes a member to owner');
select lives_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'owner@acme.test', 'member') $$,
    'with a second owner, the first can step down');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'owner@acme.test', 'owner'),
    'added', 'restore: new owner re-promotes the original owner');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'member@acme.test', 'member'),
    'added', 'restore: second owner steps back down');

-- ---------------------------------------------------------------- member
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'y@acme.test', 'member') $$,
    '42501', null, 'member cannot add members');
select is((select count(*)::int from public.org_invites), 0, 'member cannot read invites');
select is((select count(*)::int from public.profiles), 1, 'member reads only their own profile');
select is((select count(*)::int from public.org_members), 2, 'member still reads the roster');
delete from public.org_members where user_id = '00000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.org_members where role = 'owner'), 1, 'member cannot remove anyone');

-- ---------------------------------------------------------------- admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select ok(public.is_platform_admin(), 'admin is a platform admin');
select is((select count(*)::int from public.orgs), 2, 'admin sees every org');
select is((select count(*)::int from public.profiles), 4, 'admin sees every profile');
select is((select count(*)::int from public.platform_admins), 1, 'admin reads platform_admins');
select lives_ok($$
    insert into public.orgs (slug, name) values ('fresh', 'Fresh');
    insert into public.org_data_sources (org_id, data_source_id) values ('10000000-0000-0000-0000-000000000001', 'ds');
    insert into public.org_domains (org_id, domain) values ('10000000-0000-0000-0000-000000000001', 'acme.test');
    update public.orgs set default_role = 'member', log_queries = false where slug = 'acme';
$$, 'admin creates orgs, grants corpora, adds domains, changes settings');
select throws_ok($$ insert into public.org_domains (org_id, domain) values ('10000000-0000-0000-0000-000000000002', 'Bad_Domain') $$,
    '23514', null, 'domains must be lower-case hostnames');
select is(public.add_org_member('10000000-0000-0000-0000-000000000002', 'x@other.test', 'owner'),
    'added', 'admin adds owners to any org');

-- ---------------------------------------------------------------- signup claims
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'new@acme.test');
select is((select count(*)::int from public.org_members where user_id = '00000000-0000-0000-0000-0000000000e1'),
    0, 'unconfirmed sign-up claims nothing');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000e1';
select results_eq($$ select org_id, role::text from public.org_members where user_id = '00000000-0000-0000-0000-0000000000e1' $$,
    $$ values ('10000000-0000-0000-0000-000000000001'::uuid, 'owner') $$,
    'confirming the email converts the invite (domain join does not override the invited role)');
select is((select count(*)::int from public.org_invites where email = 'new@acme.test'), 0, 'invite consumed');

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-0000000000e2', 'Auto@ACME.test', now());
select results_eq($$ select org_id, role::text from public.org_members where user_id = '00000000-0000-0000-0000-0000000000e2' $$,
    $$ values ('10000000-0000-0000-0000-000000000001'::uuid, 'member') $$,
    'confirmed sign-up on a claimed domain auto-joins with default_role');

select * from finish();
rollback;
