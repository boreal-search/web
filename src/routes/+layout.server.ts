import { CONTEXT_COOKIE, contextLabel, contextValue, getAccess } from '#lib/server/access.js';
import { isPlatformAdmin } from '#lib/server/auth.js';
import type { Database } from '#lib/supabase/types.js';
import { THEME_COOKIE, THEME_COOKIE_OPTIONS, type Theme } from '#lib/theme.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LayoutServerLoad } from './$types';

/** The user's saved theme, or null if it can't be read (e.g. the column isn't migrated yet). */
async function savedTheme(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<Theme | null> {
	const { data, error } = await supabase
		.from('profiles')
		.select('theme')
		.eq('id', userId)
		.maybeSingle();
	return error || !data ? null : data.theme;
}

/**
 * Everyone: the theme (cookie; signed in, the saved choice wins and is mirrored into the cookie
 * so the next SSR is right on this device too).
 * Signed in: the user's access for this request (current context and searchable set; (app)
 * pages read it via `parent()`) plus nav. Every admin/manage route re-checks its own access.
 */
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { session, user, supabase } = locals;
	if (!user) return { session, user, theme: locals.theme, access: null, nav: null };

	const [platformAdmin, access, saved] = await Promise.all([
		isPlatformAdmin(supabase),
		getAccess(supabase, user.id, cookies.get(CONTEXT_COOKIE)),
		savedTheme(supabase, user.id)
	]);
	if (saved && saved !== locals.theme) {
		locals.theme = saved;
		cookies.set(THEME_COOKIE, saved, THEME_COOKIE_OPTIONS);
	}
	const current = contextValue(access.context);
	return {
		session,
		user,
		theme: locals.theme,
		access,
		nav: {
			isPlatformAdmin: platformAdmin,
			adminOrgs: access.memberships.filter((m) => m.role === 'admin'),
			// Switcher only when there is a choice: 2+ orgs (one org already searches public corpora).
			contexts:
				access.contexts.length > 1
					? access.contexts.map((c) => ({
							value: contextValue(c),
							label: contextLabel(c),
							current: contextValue(c) === current
						}))
					: []
		}
	};
};
