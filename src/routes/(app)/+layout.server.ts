import { requireUser } from '#lib/server/auth.js';
import { getAccessibleDataSourceIds } from '#lib/server/access.js';
import type { LayoutServerLoad } from './$types';

/** Everything under (app) requires a session. Child loads call `await parent()` for access ids. */
export const load: LayoutServerLoad = async ({ locals }) => {
	const user = requireUser();
	const accessibleDataSourceIds = await getAccessibleDataSourceIds(locals.supabase, user.id);
	return { accessibleDataSourceIds };
};
