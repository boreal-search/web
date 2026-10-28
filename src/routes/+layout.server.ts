import { CONTEXT_COOKIE, contextLabel, contextValue, getAccess } from '#lib/server/access.js';
import { isPlatformAdmin } from '#lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

/**
 * Signed in: the user's access for this request (current context and searchable set; (app)
 * pages read it via `parent()`) plus nav. Every admin/manage route re-checks its own access.
 */
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { session, user, supabase } = locals;
	if (!user) return { session, user, access: null, nav: null };

	const [platformAdmin, access] = await Promise.all([
		isPlatformAdmin(supabase),
		getAccess(supabase, user.id, cookies.get(CONTEXT_COOKIE))
	]);
	const current = contextValue(access.context);
	return {
		session,
		user,
		access,
		nav: {
			isPlatformAdmin: platformAdmin,
			adminOrgs: access.memberships.filter((m) => m.role === 'admin'),
			// Switcher only when there is a choice: 2+ orgs, or an org plus public corpora.
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
