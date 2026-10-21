-- Control plane for the Boreal web app: who exists, which org they belong to, and which
-- engine data sources each org may query. Corpora, pages and vectors live in the engine's
-- own Postgres, NOT here; `org_data_sources.data_source_id` is the engine's slug.

create type public.org_role as enum ('owner', 'member');

-- One row per auth user, created by trigger. Keeps auth.users private.
create table public.profiles (
    id           uuid primary key references auth.users (id) on delete cascade,
    email        text not null,
    display_name text,
    created_at   timestamptz not null default now()
);

create table public.orgs (
    id         uuid primary key default gen_random_uuid(),
    slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    name       text not null,
    created_at timestamptz not null default now()
);

create table public.org_members (
    org_id     uuid not null references public.orgs (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    role       public.org_role not null default 'member',
    created_at timestamptz not null default now(),
    primary key (org_id, user_id)
);
create index org_members_user_id_idx on public.org_members (user_id);

-- Grants an org access to an engine data source. Managed by us (service role / SQL) for now.
create table public.org_data_sources (
    org_id         uuid not null references public.orgs (id) on delete cascade,
    data_source_id text not null check (data_source_id ~ '^[a-z0-9][a-z0-9_-]{0,127}$'),
    created_at     timestamptz not null default now(),
    primary key (org_id, data_source_id)
);

-- ---------------------------------------------------------------------------
-- Profile bootstrap: mirror new auth users into public.profiles.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name')
    )
    on conflict (id) do update set email = excluded.email;
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security. Users see only themselves and the orgs they belong to.
-- Membership/grant writes are done by us with the service role until there is
-- a self-serve admin UI; no insert/update/delete policies for `authenticated`.
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.orgs             enable row level security;
alter table public.org_members      enable row level security;
alter table public.org_data_sources enable row level security;

-- security definer so the policies below can check membership without recursing into RLS.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.org_members m
        where m.org_id = p_org_id and m.user_id = (select auth.uid())
    );
$$;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

create policy "profiles: read own" on public.profiles
    for select to authenticated
    using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
    for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

create policy "orgs: read member orgs" on public.orgs
    for select to authenticated
    using (public.is_org_member(id));

create policy "org_members: read own org rosters" on public.org_members
    for select to authenticated
    using (public.is_org_member(org_id));

create policy "org_data_sources: read own org grants" on public.org_data_sources
    for select to authenticated
    using (public.is_org_member(org_id));
