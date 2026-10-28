import { isPlatformAdmin } from '#lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user, supabase } = locals;
	if (!user) return { session, user, nav: { isAdmin: false, ownedOrgs: [] } };

	// Nav links only; every admin/manage route re-checks its own access server-side.
	const [isAdmin, owned] = await Promise.all([
		isPlatformAdmin(supabase),
		supabase
			.from('org_members')
			.select('orgs(slug, name)')
			.eq('user_id', user.id)
			.eq('role', 'owner')
	]);
	if (owned.error) throw owned.error;
	const ownedOrgs = owned.data.flatMap((m) => (m.orgs ? [m.orgs] : []));
	return { session, user, nav: { isAdmin, ownedOrgs } };
};
