-- Quality review is opt-out. orgs.log_queries (default true, unchanged) decides whether Boreal
-- keeps what a search showed: the query, the query as searched, the generated summary and the
-- result locators (search_events), which platform admins read on /admin/searches. Org admins
-- may now turn it off for their org themselves; before, only platform admins could change it.
-- It covers analytics only: orgs.conversation_history still decides whether trails are stored.

comment on column public.orgs.log_queries is
    'Keep query text, summaries and result locators in search_events for Boreal''s quality '
    'review (platform admins). Off: only lengths, counts, timings and outcomes. Org admins set it.';

-- Org admins have no update on orgs (that stays platform-admin only), so this one switch goes
-- through a function. Idempotent.
create function public.set_org_log_queries(p_org_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not (public.is_platform_admin() or public.is_org_admin(p_org_id)) then
        raise exception 'only a platform admin or an admin of this org can change this'
            using errcode = '42501';
    end if;
    update public.orgs set log_queries = p_on where id = p_org_id;
end;
$$;
revoke all on function public.set_org_log_queries(uuid, boolean) from public, anon;
grant execute on function public.set_org_log_queries(uuid, boolean) to authenticated;
