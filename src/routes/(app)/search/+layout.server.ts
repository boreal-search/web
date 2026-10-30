// The search screen's shell: the sidebar's trail list (yours and shared with you, most recent
// first; /trails redirects here) and the viewer's layout choices (sidebar, divider), from cookies
// so the first paint matches. Trail actions on the page re-run this, so the list follows renames
// and deletes; a stored step invalidates TRAILS_DEPENDENCY, so a new or added-to trail comes to the top.
import { requireUser } from '#lib/server/auth.js';
import { listTrails } from '#lib/server/trails.js';
import {
	parseSidebar,
	parseSplit,
	SIDEBAR_COOKIE,
	SPLIT_COOKIE,
	TRAILS_DEPENDENCY
} from '#lib/components/search/layout-prefs.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	const user = requireUser();
	depends(TRAILS_DEPENDENCY);
	return {
		trails: await listTrails(locals.supabase, user.id),
		sidebar: parseSidebar(cookies.get(SIDEBAR_COOKIE)),
		split: parseSplit(cookies.get(SPLIT_COOKIE))
	};
};
