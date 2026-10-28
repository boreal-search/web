-- Roles and self-serve org management.
--   platform admin (global, `platform_admins`): everything.
--   org owner: manages members and invites of their own org (and may grant 'owner').
--   org member: searches.
-- All writes go through RLS with the user's session (anon key); there is no service-role key
-- in the web app. Membership writes go through `add_org_member` so "account exists → member,
-- else → invite" is decided in one place.
--
-- Seats are membership rows. A seat limit would be `orgs.seat_limit`, checked in
-- `add_org_member` and in the auto-join in `handle_new_user`.

create table public.platform_admins (
    user_id    uuid primary key references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now()
);

-- Pending memberships for emails without an account yet; converted on email confirmation.
create table public.org_invites (
    org_id     uuid not null references public.orgs (id) on delete cascade,
    email      text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    role       public.org_role not null default 'member',
    invited_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (org_id, email)
);
create index org_invites_email_idx on public.org_invites (email);

-- Email-domain auto-join: a confirmed user whose email domain matches joins the org with
-- `orgs.default_role`. One org per domain.
create table public.org_domains (
    org_id     uuid not null references public.orgs (id) on delete cascade,
    domain     text not null unique check (
        domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    ),
    created_at timestamptz not null default now(),
    primary key (org_id, domain)
);

alter table public.orgs
    add column default_role public.org_role not null default 'member';

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies can call them without recursing into RLS).
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.platform_admins a where a.user_id = (select auth.uid())
    );
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.org_members m
        where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.role = 'owner'
    );
$$;
revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- add_org_member: the single membership write path for admins and owners. Idempotent;
-- calling it again with another role changes the role (member or pending invite).
-- ---------------------------------------------------------------------------
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
    if not (public.is_platform_admin() or public.is_org_owner(p_org_id)) then
        raise exception 'only a platform admin or an owner of this org can add members'
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
revoke all on function public.add_org_member(uuid, text, public.org_role) from public;
grant execute on function public.add_org_member(uuid, text, public.org_role) to authenticated;

-- ---------------------------------------------------------------------------
-- An org keeps at least one owner while users manage it. Platform admins and SQL/service
-- sessions (no auth.uid(), e.g. deleting a user) are exempt so cascades never get stuck.
-- ---------------------------------------------------------------------------
create or replace function public.keep_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if old.role <> 'owner'
        or (tg_op = 'UPDATE' and new.role = 'owner')
        or (select auth.uid()) is null
        or public.is_platform_admin() then
        return coalesce(new, old);
    end if;
    if not exists (
        select 1 from public.org_members m
        where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id
    ) then
        raise exception 'an org must keep at least one owner' using errcode = '23514';
    end if;
    return coalesce(new, old);
end;
$$;

create trigger org_members_keep_last_owner
    before update of role or delete on public.org_members
    for each row execute function public.keep_last_owner();

-- ---------------------------------------------------------------------------
-- Profile bootstrap, now also claiming invites and domain auto-joins. Memberships are only
-- granted once the email is confirmed (insert with email_confirmed_at set, or the later
-- update that sets it), so an unverified sign-up can't join an org by claiming an address.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email text := lower(new.email);
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name')
    )
    on conflict (id) do update set email = excluded.email;

    if new.email_confirmed_at is null or v_email is null then
        return new;
    end if;

    insert into public.org_members (org_id, user_id, role)
    select i.org_id, new.id, i.role from public.org_invites i where i.email = v_email
    on conflict (org_id, user_id) do nothing;
    delete from public.org_invites where email = v_email;

    insert into public.org_members (org_id, user_id, role)
    select d.org_id, new.id, o.default_role
    from public.org_domains d join public.orgs o on o.id = d.org_id
    where d.domain = split_part(v_email, '@', 2)
    on conflict (org_id, user_id) do nothing;

    return new;
end;
$$;

drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert or update of email, email_confirmed_at on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security. Existing member read policies stay; these add admin and owner powers.
-- ---------------------------------------------------------------------------
alter table public.platform_admins enable row level security;
alter table public.org_invites     enable row level security;
alter table public.org_domains     enable row level security;

create policy "platform_admins: admin read" on public.platform_admins
    for select to authenticated
    using (public.is_platform_admin());

create policy "profiles: admin read" on public.profiles
    for select to authenticated
    using (public.is_platform_admin());

-- Owners need member emails for the roster; plain members don't see other profiles.
create policy "profiles: owners read their members" on public.profiles
    for select to authenticated
    using (exists (
        select 1 from public.org_members m
        where m.user_id = profiles.id and public.is_org_owner(m.org_id)
    ));

create policy "orgs: admin all" on public.orgs
    for all to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

create policy "org_members: admin all" on public.org_members
    for all to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

-- Owners read via "org_members: read own org rosters"; adds and role changes go through
-- add_org_member, so the only direct owner write is removal.
create policy "org_members: owners delete" on public.org_members
    for delete to authenticated
    using (public.is_org_owner(org_id));

create policy "org_data_sources: admin all" on public.org_data_sources
    for all to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

create policy "org_invites: admin all" on public.org_invites
    for all to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

create policy "org_invites: owners read" on public.org_invites
    for select to authenticated
    using (public.is_org_owner(org_id));

create policy "org_invites: owners revoke" on public.org_invites
    for delete to authenticated
    using (public.is_org_owner(org_id));

create policy "org_domains: admin all" on public.org_domains
    for all to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());
