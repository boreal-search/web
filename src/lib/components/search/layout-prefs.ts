// The search screen's per-viewer layout choices, kept in cookies so the server paints them on the
// first frame: the trail sidebar (open, collapsed, or unset: then medium screens start collapsed)
// and the steps column's share of the divided panes. Read by the search load, written by the browser.
export const SIDEBAR_COOKIE = 'boreal_sidebar';
export const SPLIT_COOKIE = 'boreal_split';

/** The search layout's trail list depends on this; invalidate it once a step is stored. */
export const TRAILS_DEPENDENCY = 'app:trails';

/** The viewer's sidebar choice; null until they choose (medium screens then start collapsed). */
export type SidebarChoice = 'open' | 'collapsed' | null;

export const parseSidebar = (v: string | undefined): SidebarChoice =>
	v === 'open' || v === 'collapsed' ? v : null;

/** The steps column's default share (%) of the two panes; double-clicking the divider restores it. */
export const DEFAULT_SPLIT = 40;
/** Bounds on a remembered share, whatever the cookie says; the panes' own minimums apply on top. */
const SPLIT_RANGE = [20, 75] as const;

/** A remembered steps share (%), or the default when missing or out of range. */
export function parseSplit(v: string | undefined): number {
	const n = Number(v);
	return v && Number.isFinite(n) && n >= SPLIT_RANGE[0] && n <= SPLIT_RANGE[1]
		? Math.round(n * 10) / 10
		: DEFAULT_SPLIT;
}

/** A blocked cookie only costs the memory: the choice lasts for this page. */
function remember(name: string, value: string) {
	try {
		document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// cookies blocked
	}
}

export const rememberSidebar = (collapsed: boolean) =>
	remember(SIDEBAR_COOKIE, collapsed ? 'collapsed' : 'open');

export const rememberSplit = (steps: number) =>
	remember(SPLIT_COOKIE, String(parseSplit(String(steps))));
