-- Last sign-in for /admin/users. It lives in auth.users, which the app never reads directly, so
-- platform admins get this one column for the ids on the page they're viewing, and nothing else.
create function public.admin_last_sign_ins(p_user_ids uuid[])
returns table (user_id uuid, last_sign_in_at timestamptz)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
    if not public.is_platform_admin() then
        raise exception 'platform admins only' using errcode = '42501';
    end if;
    return query
        select u.id, u.last_sign_in_at from auth.users u where u.id = any (p_user_ids);
end;
$$;
revoke all on function public.admin_last_sign_ins(uuid[]) from public, anon;
grant execute on function public.admin_last_sign_ins(uuid[]) to authenticated;
