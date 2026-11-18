-- The search trail (infra/docs/handovers/2026-10-28-search-trail.md): each search is a
-- numbered step with its own scope, results and checked summary, kept as a record.
--   trails: private to their owner. Not the org, not org admins, not platform admins.
--   trail_shares: the owner shares a trail read-only with named members of its org.
--   trail_steps: snapshots of what the user saw (no signed URLs). Inserted when results
--     arrive, completed once with the summary and readout; never edited after that.
--   orgs.conversation_history: off = no trails stored for that org (separate from
--     log_queries, which covers analytics only). Public-context trails (org_id null) are
--     always stored. Trails are kept until their owner deletes them.

alter table public.orgs
    add column conversation_history boolean not null default true;

create table public.trails (
    id         uuid primary key default gen_random_uuid(),
    org_id     uuid references public.orgs (id) on delete cascade,   -- null = Public context
    user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    title      text not null check (char_length(title) between 1 and 500),  -- step 01's query
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index trails_user_updated_idx on public.trails (user_id, updated_at desc);

create table public.trail_shares (
    trail_id   uuid not null references public.trails (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,  -- shared with
    created_at timestamptz not null default now(),
    primary key (trail_id, user_id)
);
create index trail_shares_user_idx on public.trail_shares (user_id);

create table public.trail_steps (
    id             uuid primary key default gen_random_uuid(),
    trail_id       uuid not null references public.trails (id) on delete cascade,
    n              int  not null check (n >= 1),   -- set by trigger: 1, 2, 3 (shown 01, 02, 03)
    query          text not null,                  -- as typed
    resolved_query text not null,                  -- as searched
    rewrite        boolean not null default true,
    scope          jsonb not null,                 -- response.scope + names for display
    builds_on      int check (builds_on is null or builds_on >= 1),
    results        jsonb not null,                 -- results without signed URLs
    answer         jsonb,                          -- response.answer, or null
    readout        jsonb not null,
    created_at     timestamptz not null default now(),
    unique (trail_id, n)
);

-- ---------------------------------------------------------------------------
-- Helpers. security definer so the policies below don't recurse into each other's RLS.
-- ---------------------------------------------------------------------------

-- The caller owns the trail.
create or replace function public.owns_trail(p_trail_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.trails t
        where t.id = p_trail_id and t.user_id = (select auth.uid())
    );
$$;

-- The caller owns the trail or it is shared with them.
create or replace function public.can_read_trail(p_trail_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select public.owns_trail(p_trail_id) or exists (
        select 1 from public.trail_shares s
        where s.trail_id = p_trail_id and s.user_id = (select auth.uid())
    );
$$;

-- A trail may be stored in this context: Public, or an org the caller belongs to that keeps
-- search history.
create or replace function public.keeps_trails(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select p_org_id is null or exists (
        select 1 from public.org_members m join public.orgs o on o.id = m.org_id
        where m.org_id = p_org_id and m.user_id = (select auth.uid()) and o.conversation_history
    );
$$;

-- The caller owns the trail and may still write to it (its org keeps history).
create or replace function public.can_write_trail(p_trail_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.trails t
        where t.id = p_trail_id and t.user_id = (select auth.uid()) and public.keeps_trails(t.org_id)
    );
$$;

revoke all on function public.owns_trail(uuid) from public;
revoke all on function public.can_read_trail(uuid) from public;
revoke all on function public.keeps_trails(uuid) from public;
revoke all on function public.can_write_trail(uuid) from public;
grant execute on function public.owns_trail(uuid) to authenticated;
grant execute on function public.can_read_trail(uuid) to authenticated;
grant execute on function public.keeps_trails(uuid) to authenticated;
grant execute on function public.can_write_trail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Steps: n is assigned here; a step is completed once (answer, readout) and is otherwise a
-- record. Each new step bumps its trail's updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.trail_steps_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    -- Serialize step numbering per trail; the unique (trail_id, n) is the backstop.
    perform 1 from public.trails where id = new.trail_id for update;
    select coalesce(max(s.n), 0) + 1 into new.n from public.trail_steps s where s.trail_id = new.trail_id;
    if new.builds_on is not null and new.builds_on >= new.n then
        raise exception 'builds_on % must be an earlier step', new.builds_on using errcode = '23514';
    end if;
    new.created_at := now();
    update public.trails set updated_at = now() where id = new.trail_id;
    return new;
end;
$$;

create trigger trail_steps_insert
    before insert on public.trail_steps
    for each row execute function public.trail_steps_insert();

create or replace function public.trail_steps_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if (new.trail_id, new.n, new.query, new.resolved_query, new.rewrite, new.scope, new.builds_on,
        new.results, new.created_at)
       is distinct from
       (old.trail_id, old.n, old.query, old.resolved_query, old.rewrite, old.scope, old.builds_on,
        old.results, old.created_at) then
        raise exception 'a trail step is a record: only its summary and readout can be completed'
            using errcode = '42501';
    end if;
    if old.answer is not null and new.answer is distinct from old.answer then
        raise exception 'a trail step''s summary is already recorded' using errcode = '42501';
    end if;
    return new;
end;
$$;

create trigger trail_steps_update
    before update on public.trail_steps
    for each row execute function public.trail_steps_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.trails enable row level security;
alter table public.trail_shares enable row level security;
alter table public.trail_steps enable row level security;

create policy "trails: read own or shared" on public.trails
    for select to authenticated
    using (user_id = (select auth.uid()) or public.can_read_trail(id));

create policy "trails: insert own where history is kept" on public.trails
    for insert to authenticated
    with check (user_id = (select auth.uid()) and public.keeps_trails(org_id));

create policy "trails: update own where history is kept" on public.trails
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and public.keeps_trails(org_id));

-- Deleting is always allowed to the owner, even after their org stops keeping history.
create policy "trails: delete own" on public.trails
    for delete to authenticated
    using (user_id = (select auth.uid()));

create policy "trail_shares: read as owner or recipient" on public.trail_shares
    for select to authenticated
    using (user_id = (select auth.uid()) or public.owns_trail(trail_id));

-- Only to members of the trail's org; Public-context trails can't be shared.
create policy "trail_shares: owner adds org members" on public.trail_shares
    for insert to authenticated
    with check (
        user_id <> (select auth.uid())
        and exists (
            select 1 from public.trails t join public.org_members m on m.org_id = t.org_id
            where t.id = trail_id and t.user_id = (select auth.uid())
              and m.user_id = trail_shares.user_id
        )
    );

create policy "trail_shares: owner removes" on public.trail_shares
    for delete to authenticated
    using (public.owns_trail(trail_id));

create policy "trail_steps: read with trail" on public.trail_steps
    for select to authenticated
    using (public.can_read_trail(trail_id));

create policy "trail_steps: owner inserts" on public.trail_steps
    for insert to authenticated
    with check (public.can_write_trail(trail_id));

create policy "trail_steps: owner completes" on public.trail_steps
    for update to authenticated
    using (public.can_write_trail(trail_id))
    with check (public.can_write_trail(trail_id));

-- ---------------------------------------------------------------------------
-- People on a trail, for the share control. Members can't read each other's profiles, so
-- this returns names for a trail the caller can read: its owner and the people it is shared
-- with; and, to the owner only, the other members of its org (whom it can be shared with).
-- ---------------------------------------------------------------------------
create or replace function public.trail_people(p_trail_id uuid)
returns table (user_id uuid, email text, display_name text, relation text)
language sql
security definer
stable
set search_path = ''
as $$
    with t as (
        select tr.id, tr.user_id, tr.org_id from public.trails tr
        where tr.id = p_trail_id and public.can_read_trail(tr.id)
    )
    select p.id, p.email, p.display_name, 'owner'
    from t join public.profiles p on p.id = t.user_id
    union all
    select p.id, p.email, p.display_name, 'shared'
    from t join public.trail_shares s on s.trail_id = t.id join public.profiles p on p.id = s.user_id
    union all
    select p.id, p.email, p.display_name, 'member'
    from t join public.org_members m on m.org_id = t.org_id join public.profiles p on p.id = m.user_id
    where t.user_id = (select auth.uid())
      and m.user_id <> t.user_id
      and not exists (select 1 from public.trail_shares s where s.trail_id = t.id and s.user_id = m.user_id);
$$;
revoke all on function public.trail_people(uuid) from public;
grant execute on function public.trail_people(uuid) to authenticated;
