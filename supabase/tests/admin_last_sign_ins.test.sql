-- pgTAP: admin_last_sign_ins is for platform admins only and returns just the ids asked for.
begin;
select plan(5);

insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test',  now(), '2026-10-27 09:00Z'),
    ('00000000-0000-0000-0000-00000000000b', 'member@boreal.test', now(), null),
    ('00000000-0000-0000-0000-00000000000c', 'other@boreal.test',  now(), '2026-10-01 12:00Z');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
    $$ select user_id, last_sign_in_at from public.admin_last_sign_ins(array[
        '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']::uuid[])
       order by user_id $$,
    $$ values ('00000000-0000-0000-0000-00000000000a'::uuid, '2026-10-27 09:00Z'::timestamptz),
              ('00000000-0000-0000-0000-00000000000b'::uuid, null::timestamptz) $$,
    'admin reads last sign-in for the ids asked for, and only those');
select is((select count(*)::int from public.admin_last_sign_ins('{}')), 0, 'no ids, no rows');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select * from public.admin_last_sign_ins(array['00000000-0000-0000-0000-00000000000c']::uuid[]) $$,
    '42501', 'platform admins only', 'a member cannot call it');
reset role;

set local role anon;
select throws_ok($$ select * from public.admin_last_sign_ins(array['00000000-0000-0000-0000-00000000000c']::uuid[]) $$,
    '42501', null, 'anon cannot call it');
reset role;

select ok(not has_function_privilege('anon', 'public.admin_last_sign_ins(uuid[])', 'execute'),
    'anon has no execute grant');

select * from finish();
rollback;
