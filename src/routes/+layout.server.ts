import { contextLabel, contextValue, getAccess } from '#lib/server/access.js';
import { isPlatformAdmin } from '#lib/server/auth.js';
import type { Database } from '#lib/supabase/types.js';
import { THEME_COOKIE, THEME_COOKIE_OPTIONS, type Theme } from '#lib/theme.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LayoutServerLoad } from './$types';

async function savedTheme(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<Theme | null> {
	const { data, error } = await supabase
		.from('profiles')
		.select('theme')
		.eq('id', userId)
		.maybeSingle();
	if (error) throw error;
	return data?.theme ?? null;
}

/**
 * Everyone: the theme (cookie; signed in, the saved choice wins and is mirrored into the cookie
 * so the next SSR is right on this device too).
 * Signed in: the user's access for this request (current context and searchable set) plus nav
 * (user menu, context switcher). Server loads read access through `getAccess()`, not `parent()`,
 * so a client navigation re-runs only the page's own load. Every admin/manage route re-checks
 * its own access.
 */
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { supabase } = locals;
	// Only what pages render: the full User and the session tokens stay server-side.
	const user = locals.user && { id: locals.user.id, email: locals.user.email };
	if (!user) return { user, theme: locals.theme, access: null, nav: null };

	const [platformAdmin, access, saved] = await Promise.all([
		isPlatformAdmin(),
		getAccess(),
		savedTheme(supabase, user.id)
	]);
	if (saved && saved !== locals.theme) {
		locals.theme = saved;
		cookies.set(THEME_COOKIE, saved, THEME_COOKIE_OPTIONS);
	}
	const current = contextValue(access.context);
	return {
		user,
		theme: locals.theme,
		access,
		nav: {
			isPlatformAdmin: platformAdmin,
			adminOrgs: access.memberships.filter((m) => m.role === 'admin'),
			// The switcher offers a choice only with 2+ (one org already searches public corpora).
			contexts: access.contexts.map((c) => ({
				value: contextValue(c),
				label: contextLabel(c),
				current: contextValue(c) === current
			}))
		}
	};
};
