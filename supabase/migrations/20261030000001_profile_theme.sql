-- Colour theme, saved per user (brand: System / Light / Dark). The web mirrors it in the
-- `boreal_theme` cookie so SSR can render it. "profiles: update own" already lets a user
-- update their own row, so no new policy is needed.
alter table public.profiles
    add column theme text not null default 'system' check (theme in ('system', 'light', 'dark'));

-- "profiles: update own" has no column limit, so a user could rewrite their own email. Email
-- follows auth.users (the security-definer auth trigger); users may change only these columns.
revoke update on public.profiles from authenticated;
grant update (display_name, theme) on public.profiles to authenticated;
