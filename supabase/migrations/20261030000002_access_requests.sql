-- Access requests: a signed-in user with no org asks for their organization's documents.
-- Founders review them on /admin, then create the org and invite the user (existing tools)
-- and mark the request done.
--   users: insert and read their own; at most one open request each; no updates.
--   platform admins: read all, update `status` only.
-- No deletes from the app (no delete policy). `email` is copied from the user's profile at
-- insert, so the row says who asked even if the profile later changes.

create table public.access_requests (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    email        text not null,
    organization text not null check (char_length(organization) between 1 and 200),
    role         text check (role is null or char_length(role) between 1 and 200),
    use_case     text not null check (char_length(use_case) between 1 and 2000),
    status       text not null default 'open' check (status in ('open', 'done')),
    created_at   timestamptz not null default now()
);

-- One open request per user: a second insert while one is open fails with 23505, and the
-- web shows the open one instead.
create unique index access_requests_one_open_idx
    on public.access_requests (user_id) where status = 'open';
create index access_requests_open_created_idx
    on public.access_requests (created_at) where status = 'open';

-- The requester's email and the timestamp come from the database, not the client.
create or replace function public.access_requests_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    select u.email into new.email from auth.users u where u.id = new.user_id;
    if new.email is null then
        raise exception 'no profile for user %', new.user_id using errcode = '23503';
    end if;
    new.created_at := now();
    return new;
end;
$$;

create trigger access_requests_fill
    before insert on public.access_requests
    for each row execute function public.access_requests_fill();

alter table public.access_requests enable row level security;

create policy "access_requests: insert own open" on public.access_requests
    for insert to authenticated
    with check (user_id = (select auth.uid()) and status = 'open');

create policy "access_requests: read own" on public.access_requests
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy "access_requests: admin read" on public.access_requests
    for select to authenticated
    using (public.is_platform_admin());

create policy "access_requests: admin update" on public.access_requests
    for update to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

-- Admins change the status and nothing else.
revoke update on public.access_requests from anon, authenticated;
grant update (status) on public.access_requests to authenticated;
