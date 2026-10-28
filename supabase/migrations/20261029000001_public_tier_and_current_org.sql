-- Public tier and current org.
--   public_data_sources: engine corpora every signed-in user may search, with no org and no
--     seat. The web's searchable set is (current org's grants) ∪ (public_data_sources).
--   search_events.org_id becomes nullable: a search in the "Public" context is recorded with
--     org_id = null (and its query text). Members never see those rows; platform admins do.

create table public.public_data_sources (
    data_source_id text primary key check (data_source_id ~ '^[a-z0-9][a-z0-9_-]{0,127}$'),
    created_at     timestamptz not null default now()
);

alter table public.public_data_sources enable row level security;

create policy "public_data_sources: read" on public.public_data_sources
    for select to authenticated
    using (true);

create policy "public_data_sources: admin insert" on public.public_data_sources
    for insert to authenticated
    with check (public.is_platform_admin());

create policy "public_data_sources: admin delete" on public.public_data_sources
    for delete to authenticated
    using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- search_events: org_id null = a search in the Public context.
-- "search_events: insert own org" and "read own org" call is_org_member(org_id), which is
-- false for null, so members can neither write nor read null-org rows through them.
-- ---------------------------------------------------------------------------
alter table public.search_events alter column org_id drop not null;

create policy "search_events: insert public" on public.search_events
    for insert to authenticated
    with check (org_id is null and user_id = (select auth.uid()));

-- Platform admins read every search, including public ones (nothing granted this before).
create policy "search_events: admin read" on public.search_events
    for select to authenticated
    using (public.is_platform_admin());

-- org_search_daily (security_invoker) needs no change: null-org rows form their own
-- org_id = null group, visible only to readers who can see them, i.e. platform admins.
