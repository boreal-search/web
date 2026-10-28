import { error, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getRequestEvent } from '$app/server';
import type { Database, OrgRole } from '#lib/supabase/types.js';

/** Call from any server load/action: returns the validated user or redirects to /login. */
export function requireUser() {
	const { locals, url } = getRequestEvent();
	if (!locals.user) {
		const redirectTo = url.pathname + url.search;
		redirect(303, `/login?${new URLSearchParams({ redirectTo })}`);
	}
	return locals.user;
}

export async function isPlatformAdmin(supabase: SupabaseClient<Database>): Promise<boolean> {
	const { data, error: e } = await supabase.rpc('is_platform_admin');
	if (e) throw e;
	return data;
}

/** The user's role in an org, or null if they aren't a member. */
export async function getOrgRole(
	supabase: SupabaseClient<Database>,
	orgId: string,
	userId: string
): Promise<OrgRole | null> {
	const { data, error: e } = await supabase
		.from('org_members')
		.select('role')
		.eq('org_id', orgId)
		.eq('user_id', userId)
		.maybeSingle();
	if (e) throw e;
	return data?.role ?? null;
}

/** Guard for /admin: platform admins only (403 otherwise). */
export async function requirePlatformAdmin() {
	const user = requireUser();
	const { locals } = getRequestEvent();
	if (!(await isPlatformAdmin(locals.supabase))) error(403, 'Platform admins only');
	return user;
}

/**
 * Guard for /orgs/[slug]/manage: an org admin of that org, or a platform admin. 404 when the
 * org isn't visible to the user (RLS), 403 when it is but they're a plain member.
 */
export async function requireOrgAdmin(slug: string) {
	const user = requireUser();
	const { locals } = getRequestEvent();
	const { data: org, error: e } = await locals.supabase
		.from('orgs')
		.select('id, slug, name, log_queries, default_role')
		.eq('slug', slug)
		.maybeSingle();
	if (e) throw e;
	if (!org) error(404, 'Org not found');

	const [platformAdmin, role] = await Promise.all([
		isPlatformAdmin(locals.supabase),
		getOrgRole(locals.supabase, org.id, user.id)
	]);
	if (!platformAdmin && role !== 'admin') error(403, 'Only org admins can manage this org');
	return { user, org, isPlatformAdmin: platformAdmin };
}
