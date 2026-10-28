-- 1. One vocabulary: platform admin / org admin / member. The org role 'owner' becomes 'admin';
--    everything that named it is replaced (no compatibility shims). Behaviour is unchanged:
--    org admins manage members and invites of their own org, and an org keeps at least one.
-- 2. search_status splits engine failures by cause (bottom of the file).

alter type public.org_role rename value 'owner' to 'admin';

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.org_members m
        where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.role = 'admin'
    );
$$;
revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- add_org_member: the single membership write path for platform admins and org admins.
-- Idempotent; calling it again with another role changes the role (member or pending invite).
create or replace function public.add_org_member(p_org_id uuid, p_email text, p_role public.org_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email text := lower(trim(p_email));
    v_user  uuid;
begin
    if not (public.is_platform_admin() or public.is_org_admin(p_org_id)) then
        raise exception 'only a platform admin or an admin of this org can add members'
            using errcode = '42501';
    end if;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'invalid email: %', p_email using errcode = '22023';
    end if;

    select p.id into v_user from public.profiles p where lower(p.email) = v_email limit 1;

    if v_user is not null then
        insert into public.org_members (org_id, user_id, role)
        values (p_org_id, v_user, p_role)
        on conflict (org_id, user_id) do update set role = excluded.role;
        delete from public.org_invites where org_id = p_org_id and email = v_email;
        return 'added';
    end if;

    insert into public.org_invites (org_id, email, role, invited_by)
    values (p_org_id, v_email, p_role, (select auth.uid()))
    on conflict (org_id, email) do update set role = excluded.role;
    return 'invited';
end;
$$;

-- An org keeps at least one org admin while users manage it. Platform admins and SQL/service
-- sessions (no auth.uid(), e.g. deleting a user) are exempt so cascades never get stuck.
drop trigger org_members_keep_last_owner on public.org_members;
drop function public.keep_last_owner();

create function public.keep_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if old.role <> 'admin'
        or (tg_op = 'UPDATE' and new.role = 'admin')
        or (select auth.uid()) is null
        or public.is_platform_admin() then
        return coalesce(new, old);
    end if;
    if not exists (
        select 1 from public.org_members m
        where m.org_id = old.org_id and m.role = 'admin' and m.user_id <> old.user_id
    ) then
        raise exception 'an org must keep at least one org admin' using errcode = '23514';
    end if;
    return coalesce(new, old);
end;
$$;

create trigger org_members_keep_last_admin
    before update of role or delete on public.org_members
    for each row execute function public.keep_last_admin();

-- Org-admin policies, renamed and pointed at is_org_admin.
drop policy "profiles: owners read their members" on public.profiles;
drop policy "org_members: owners delete" on public.org_members;
drop policy "org_invites: owners read" on public.org_invites;
drop policy "org_invites: owners revoke" on public.org_invites;

-- Org admins need member emails for the roster; plain members don't see other profiles.
create policy "profiles: org admins read their members" on public.profiles
    for select to authenticated
    using (exists (
        select 1 from public.org_members m
        where m.user_id = profiles.id and public.is_org_admin(m.org_id)
    ));

-- Org admins read via "org_members: read own org rosters"; adds and role changes go through
-- add_org_member, so the only direct org-admin write is removal.
create policy "org_members: org admins delete" on public.org_members
    for delete to authenticated
    using (public.is_org_admin(org_id));

create policy "org_invites: org admins read" on public.org_invites
    for select to authenticated
    using (public.is_org_admin(org_id));

create policy "org_invites: org admins revoke" on public.org_invites
    for delete to authenticated
    using (public.is_org_admin(org_id));

drop function public.is_org_owner(uuid);

-- ---------------------------------------------------------------------------
-- Search outcomes: split engine failures by cause so analytics show *why* searches fail.
--   timeout     no engine response within the web app's timeout
--   unreachable network error / tunnel 502·504·530: the workstation is off
--   unavailable 503: engine up, Qdrant or Ollama down
--   engine_error any other engine error
-- New values aren't used in this migration (Postgres forbids that before commit).
-- ---------------------------------------------------------------------------
alter type public.search_status add value 'timeout';
alter type public.search_status add value 'unreachable';
alter type public.search_status add value 'unavailable';

-- engine_errors now counts every engine failure kind.
create or replace view public.org_search_daily
with (security_invoker = true) as
select
    org_id,
    date_trunc('day', created_at)::date                    as day,
    count(*)                                               as searches,
    count(*) filter (where status = 'ok')                  as ok,
    count(*) filter (where status not in ('ok', 'forbidden')) as engine_errors,
    count(*) filter (where status = 'ok' and result_count = 0) as zero_result,
    count(distinct user_id)                                as active_users,
    percentile_cont(0.5) within group (order by retrieval_ms) as p50_retrieval_ms,
    percentile_cont(0.95) within group (order by retrieval_ms) as p95_retrieval_ms
from public.search_events
group by org_id, day;
