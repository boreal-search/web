-- pgTAP: access_requests RLS, the one-open-request index and the email fill. Everything rolls back.
begin;
select plan(16);

insert into auth.users (id, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@boreal.test',  now()),
    ('00000000-0000-0000-0000-00000000000e', 'nobody@public.test', now()),
    ('00000000-0000-0000-0000-00000000000f', 'other@public.test',  now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
    select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
$$;

-- ---------------------------------------------------------------- requester
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select throws_ok($$ update public.profiles set email = 'spoof@evil.test' $$,
    '42501', null, 'user cannot rewrite their profile email');
select lives_ok($$
    insert into public.access_requests (organization, role, use_case, email, created_at)
    values ('Acme Consulting', 'EA lead', 'Search our assessment archive.', 'spoof@evil.test', '2000-01-01')
$$, 'user requests access');
select results_eq($$ select user_id, email, status, created_at > now() - interval '1 minute'
                     from public.access_requests $$,
    $$ values ('00000000-0000-0000-0000-00000000000e'::uuid, 'nobody@public.test', 'open', true) $$,
    'user_id defaults to the caller; email and created_at come from the database');
select throws_ok($$ insert into public.access_requests (organization, use_case) values ('Acme', 'Again') $$,
    '23505', null, 'one open request per user');
select throws_ok($$ insert into public.access_requests (user_id, organization, use_case)
                    values ('00000000-0000-0000-0000-00000000000f', 'Acme', 'For someone else') $$,
    '42501', null, 'user cannot request for someone else');
select throws_ok($$ insert into public.access_requests (organization, use_case, status) values ('Acme', 'Done', 'done') $$,
    '42501', null, 'user cannot insert a done request');
select throws_ok($$ insert into public.access_requests (organization, use_case) values ('', 'x') $$,
    '23514', null, 'organization is required');
select throws_ok($$ insert into public.access_requests (organization, use_case) values (repeat('a', 201), 'x') $$,
    '23514', null, 'organization is at most 200 characters');
select throws_ok($$ insert into public.access_requests (organization, use_case) values ('Acme', repeat('a', 2001)) $$,
    '23514', null, 'use case is at most 2000 characters');
update public.access_requests set status = 'done';
delete from public.access_requests;
reset role;
select results_eq($$ select status from public.access_requests $$, $$ values ('open') $$,
    'user cannot update or delete their request');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select lives_ok($$ insert into public.access_requests (organization, use_case) values ('Other Co', 'Ours.') $$,
    'second user requests access');
select is((select count(*)::int from public.access_requests), 1, 'user reads only their own request');

-- ---------------------------------------------------------------- admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.access_requests where status = 'open'), 2, 'admin reads every request');
select lives_ok($$ update public.access_requests set status = 'done' where email = 'nobody@public.test' $$,
    'admin marks a request done');
select throws_ok($$ update public.access_requests set organization = 'Changed' $$,
    '42501', null, 'admin updates the status only');

-- Done frees the slot for a new request.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select lives_ok($$ insert into public.access_requests (organization, use_case) values ('Acme', 'Again, later.') $$,
    'after done, the user can request again');

select * from finish();
rollback;
