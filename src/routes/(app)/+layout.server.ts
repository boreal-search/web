// Everything under (app) requires a session and renders in the app shell: the sidebar lists
// the current context's trails (yours and shared with you, most recent first), only the latest
// TRAIL_LIMIT unless `?all=1`. Trail actions re-run this; a stored step invalidates
// TRAILS_DEPENDENCY, so a new or added-to trail comes to the top.
import { getAccess } from '#lib/server/access.js';
import { requireUser } from '#lib/server/auth.js';
import { listTrails, TRAIL_LIMIT } from '#lib/server/trails.js';
import {
	parseSidebar,
	SIDEBAR_COOKIE,
	TRAILS_DEPENDENCY
} from '#lib/components/search/layout-prefs.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends, url }) => {
	const user = requireUser();
	depends(TRAILS_DEPENDENCY);
	const access = await getAccess();
	const all = url.searchParams.get('all') === '1';
	// With one context, every trail (older ones may predate joining the org).
	const context = access.contexts.length > 1 ? access.context : null;
	const { trails, more } = await listTrails(
		locals.supabase,
		user.id,
		context,
		all ? null : TRAIL_LIMIT
	);
	return {
		// Non-null here, for the pages' components.
		access,
		trails,
		trailView: { all, more },
		sidebarCollapsed: parseSidebar(cookies.get(SIDEBAR_COOKIE))
	};
};
