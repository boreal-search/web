// The search screen's trail sidebar: its collapsed state is a per-viewer cookie (read by the
// search load so the first paint matches, written by the browser).
export const SIDEBAR_COOKIE = 'boreal_sidebar';

/** The search layout's trail list depends on this; invalidate it once a step is stored. */
export const TRAILS_DEPENDENCY = 'app:trails';

/** Remember the viewer's choice; a blocked cookie only costs the memory. */
export function rememberSidebar(collapsed: boolean) {
	try {
		document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// cookies blocked: the choice lasts for this page only
	}
}
