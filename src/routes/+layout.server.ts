import { isPlatformAdmin } from '#lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user, supabase } = locals;
	if (!user) return { session, user, nav: { isPlatformAdmin: false, adminOrgs: [] } };

	// Nav links only; every admin/manage route re-checks its own access server-side.
	const [platformAdmin, adminOf] = await Promise.all([
		isPlatformAdmin(supabase),
		supabase
			.from('org_members')
			.select('orgs(slug, name)')
			.eq('user_id', user.id)
			.eq('role', 'admin')
	]);
	if (adminOf.error) throw adminOf.error;
	const adminOrgs = adminOf.data.flatMap((m) => (m.orgs ? [m.orgs] : []));
	return { session, user, nav: { isPlatformAdmin: platformAdmin, adminOrgs } };
};
