/** Colour theme: `system` follows `prefers-color-scheme`; `light`/`dark` force one (brand: daylight / reading lamp). */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Per-device mirror of the saved choice, so SSR renders the right theme with no flash. */
export const THEME_COOKIE = 'boreal_theme';

/** Anything that isn't a known theme (missing cookie, forged form value) is `system`. */
export function parseTheme(value: unknown): Theme {
	return THEMES.find((t) => t === value) ?? 'system';
}

export const THEME_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	maxAge: 60 * 60 * 24 * 365
} as const;
