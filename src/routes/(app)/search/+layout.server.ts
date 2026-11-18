// The search screen's shell: the sidebar's trail list (yours and shared with you, most recent
// first; /trails redirects here) and the viewer's layout choices (sidebar, divider), from cookies
// so the first paint matches. Trail actions on the page re-run this, so the list follows renames
// and deletes; a stored step invalidates TRAILS_DEPENDENCY, so a new or added-to trail comes to the top.
// The list shows one context's trails (`?org=`, one of the user's own; the current one by
// default) and only the latest TRAIL_LIMIT unless `?all=1`.
import { contextLabel, contextValue } from '#lib/server/access.js';
import { requireUser } from '#lib/server/auth.js';
import { listTrails, TRAIL_LIMIT, trailListView } from '#lib/server/trails.js';
import {
	parseSidebar,
	parseSplit,
	SIDEBAR_COOKIE,
	SPLIT_COOKIE,
	TRAILS_DEPENDENCY
} from '#lib/components/search/layout-prefs.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends, url, parent }) => {
	const user = requireUser();
	depends(TRAILS_DEPENDENCY);
	const { access } = await parent();
	const view = trailListView(access.contexts, access.context, url.searchParams);
	const { trails, more } = await listTrails(
		locals.supabase,
		user.id,
		view.context,
		view.all ? null : TRAIL_LIMIT
	);
	return {
		trails,
		trailView: {
			// The picker, only when there's a choice.
			options: view.context
				? access.contexts.map((c) => ({ value: contextValue(c), label: contextLabel(c) }))
				: [],
			value: view.context ? contextValue(view.context) : null,
			keep: view.keep,
			more
		},
		sidebar: parseSidebar(cookies.get(SIDEBAR_COOKIE)),
		split: parseSplit(cookies.get(SPLIT_COOKIE))
	};
};
