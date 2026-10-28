-- pgTAP: public_data_sources RLS and null-org (Public context) search_events. Everything rolls back.
begin;
select plan(17);

select col_is_null('public', 'search_events', 'org_id', 'search_events.org_id is nullable');

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test',  now()),
    ('00000000-0000-0000-0000-00000000000c', 'member@acme.test',   now()),
    ('00000000-0000-0000-0000-00000000000e', 'nobody@public.test', now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orgs (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'acme', 'Acme');
insert into public.org_members (org_id, user_id) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c');
insert into public.public_data_sources (data_source_id) values ('fed-regs');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;

-- An event row for (org, user); org null = Public.
create function pg_temp.event(p_org uuid, p_user uuid) returns void language sql as $$
    insert into public.search_events (org_id, user_id, data_source_ids, query, query_length, top_k, rerank, status)
    values (p_org, p_user, array['fed-regs'], 'q', 1, 10, true, 'ok');
$$;

-- ---------------------------------------------------------------- member
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select results_eq($$ select data_source_id from public.public_data_sources $$,
    $$ values ('fed-regs') $$, 'member reads public corpora');
select throws_ok($$ insert into public.public_data_sources (data_source_id) values ('acme-docs') $$,
    '42501', null, 'member cannot make a corpus public');
delete from public.public_data_sources;
reset role;
select is((select count(*)::int from public.public_data_sources), 1, 'member cannot remove a public corpus');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ select pg_temp.event(null, '00000000-0000-0000-0000-00000000000c') $$,
    'member records a public search (null org)');
select lives_ok($$ select pg_temp.event('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c') $$,
    'member records an org search');
select throws_ok($$ select pg_temp.event(null, '00000000-0000-0000-0000-00000000000e') $$,
    '42501', null, 'a public search cannot be recorded as another user');
select is((select count(*)::int from public.search_events), 1, 'member sees their org''s searches only, not null-org rows');
select is((select count(*)::int from public.search_events where org_id is null), 0, 'member never sees null-org rows');
select is((select count(*)::int from public.org_search_daily where org_id is null), 0, 'null-org rollup hidden from members');

-- ---------------------------------------------------------------- user with no org
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select results_eq($$ select data_source_id from public.public_data_sources $$,
    $$ values ('fed-regs') $$, 'a user with no org reads public corpora');
select lives_ok($$ select pg_temp.event(null, '00000000-0000-0000-0000-00000000000e') $$,
    'a user with no org records a public search');
select throws_ok($$ select pg_temp.event('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e') $$,
    '42501', null, 'a user with no org cannot attribute a search to an org');
select is((select count(*)::int from public.search_events), 0, 'a user with no org reads no search events, not even their own public ones');

-- ---------------------------------------------------------------- platform admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$
    insert into public.public_data_sources (data_source_id) values ('bc-regs');
    delete from public.public_data_sources where data_source_id = 'fed-regs';
$$, 'platform admin makes corpora public and private');
select results_eq($$ select org_id, count(*)::int from public.search_events group by org_id order by org_id nulls last $$,
    $$ values ('10000000-0000-0000-0000-000000000001'::uuid, 1), (null::uuid, 2) $$,
    'platform admin reads every search, including null-org ones');
select results_eq($$ select org_id, searches::int from public.org_search_daily order by org_id nulls last $$,
    $$ values ('10000000-0000-0000-0000-000000000001'::uuid, 1), (null::uuid, 2) $$,
    'org_search_daily rolls null-org searches into their own row, visible to platform admins');

select * from finish();
rollback;
