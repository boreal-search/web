-- pgTAP: roles, add_org_member, invite/domain claims and RLS. Run with `supabase test db`
-- against a local stack (`supabase start`). Everything rolls back.
begin;
select plan(41);

-- Vocabulary: platform admin / org admin / member.
select enum_has_labels('public', 'org_role', array['admin', 'member'], 'org_role is admin | member');
select hasnt_function('public', 'is_org_owner', 'is_org_owner is gone');
select hasnt_function('public', 'keep_last_owner', 'keep_last_owner is gone');
select enum_has_labels('public', 'search_status',
    array['ok', 'forbidden', 'engine_error', 'timeout', 'unreachable', 'unavailable'], 'search_status splits engine failures');

-- Fixtures (as postgres, bypassing RLS).
insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test', now()),
    ('00000000-0000-0000-0000-00000000000b', 'orgadmin@acme.test',   now()),
    ('00000000-0000-0000-0000-00000000000c', 'member@acme.test',  now()),
    ('00000000-0000-0000-0000-00000000000d', 'x@other.test',      now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orgs (id, slug, name) values
    ('10000000-0000-0000-0000-000000000001', 'acme', 'Acme'),
    ('10000000-0000-0000-0000-000000000002', 'other', 'Other');
insert into public.org_members (org_id, user_id, role) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'admin'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;

-- ---------------------------------------------------------------- org admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select ok(not public.is_platform_admin(), 'org admin is not a platform admin');
select ok(public.is_org_admin('10000000-0000-0000-0000-000000000001'), 'org admin administers acme');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', ' New@Acme.TEST ', 'member'),
    'invited', 'unknown email → invite');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'new@acme.test', 'admin'),
    'invited', 'invite is idempotent and updates the role');
select results_eq($$ select email, role::text from public.org_invites $$,
    $$ values ('new@acme.test', 'admin') $$, 'one lower-cased invite, org admins can read it');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'X@other.test', 'member'),
    'added', 'existing account → member');
select is((select count(*)::int from public.profiles), 3, 'org admin reads their members'' profiles only');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000002', 'a@b.test', 'member') $$,
    '42501', null, 'org admin cannot add to another org');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'not-an-email', 'member') $$,
    '22023', null, 'invalid email rejected');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'orgadmin@acme.test', 'member') $$,
    '23514', null, 'last org admin cannot demote themselves');
select throws_ok($$ delete from public.org_members where user_id = '00000000-0000-0000-0000-00000000000b' $$,
    '23514', null, 'last org admin cannot remove themselves');
select throws_ok($$ insert into public.org_invites (org_id, email) values ('10000000-0000-0000-0000-000000000001', 'direct@acme.test') $$,
    '42501', null, 'org admins write invites only through add_org_member');
select throws_ok($$ insert into public.org_data_sources (org_id, data_source_id) values ('10000000-0000-0000-0000-000000000001', 'ds') $$,
    '42501', null, 'org admins cannot grant corpora');
select throws_ok($$ insert into public.org_domains (org_id, domain) values ('10000000-0000-0000-0000-000000000001', 'acme.test') $$,
    '42501', null, 'org admins cannot add domains');
update public.orgs set log_queries = false where slug = 'acme';
select is((select log_queries from public.orgs where slug = 'acme'), true, 'org admins cannot change org settings');
select is((select count(*)::int from public.orgs), 1, 'org admin sees only their org');
delete from public.org_members where user_id = '00000000-0000-0000-0000-00000000000d';
select is((select count(*)::int from public.org_members where user_id = '00000000-0000-0000-0000-00000000000d'),
    0, 'org admin removes a member');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'member@acme.test', 'admin'),
    'added', 'org admin promotes a member to org admin');
select lives_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'orgadmin@acme.test', 'member') $$,
    'with a second org admin, the first can step down');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'orgadmin@acme.test', 'admin'),
    'added', 'restore: new org admin re-promotes the original org admin');
select is(public.add_org_member('10000000-0000-0000-0000-000000000001', 'member@acme.test', 'member'),
    'added', 'restore: second org admin steps back down');

-- ---------------------------------------------------------------- member
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.add_org_member('10000000-0000-0000-0000-000000000001', 'y@acme.test', 'member') $$,
    '42501', null, 'member cannot add members');
select is((select count(*)::int from public.org_invites), 0, 'member cannot read invites');
select is((select count(*)::int from public.profiles), 1, 'member reads only their own profile');
select is((select count(*)::int from public.org_members), 2, 'member still reads the roster');
delete from public.org_members where user_id = '00000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.org_members where role = 'admin'), 1, 'member cannot remove anyone');

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
select is(public.add_org_member('10000000-0000-0000-0000-000000000002', 'x@other.test', 'admin'),
    'added', 'platform admin adds org admins to any org');

-- ---------------------------------------------------------------- signup claims
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'new@acme.test');
select is((select count(*)::int from public.org_members where user_id = '00000000-0000-0000-0000-0000000000e1'),
    0, 'unconfirmed sign-up claims nothing');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000e1';
select results_eq($$ select org_id, role::text from public.org_members where user_id = '00000000-0000-0000-0000-0000000000e1' $$,
    $$ values ('10000000-0000-0000-0000-000000000001'::uuid, 'admin') $$,
    'confirming the email converts the invite (domain join does not override the invited role)');
select is((select count(*)::int from public.org_invites where email = 'new@acme.test'), 0, 'invite consumed');

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-0000000000e2', 'Auto@ACME.test', now());
select results_eq($$ select org_id, role::text from public.org_members where user_id = '00000000-0000-0000-0000-0000000000e2' $$,
    $$ values ('10000000-0000-0000-0000-000000000001'::uuid, 'member') $$,
    'confirmed sign-up on a claimed domain auto-joins with default_role');

select * from finish();
rollback;
