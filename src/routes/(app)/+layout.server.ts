import { requireUser } from '#lib/server/auth.js';
import { getAccess } from '#lib/server/access.js';
import type { LayoutServerLoad } from './$types';

/** Everything under (app) requires a session. Child loads call `await parent()` for access. */
export const load: LayoutServerLoad = async ({ locals }) => {
	const user = requireUser();
	const access = await getAccess(locals.supabase, user.id);
	return { inOrg: access.orgIds.length > 0, accessibleDataSourceIds: access.dataSourceIds };
};
