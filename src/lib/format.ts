// Text formatting shared by pages. Fixed locale and zone so server and browser render the same text.

/** Thousands separators for counts (en-CA): 12345 → "12,345". */
export const count = (n: number) => n.toLocaleString('en-CA');

/** "page" / "pages". */
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** Engine statuses are lowercase identifiers ("in_progress"); show them as words, nothing more. */
export const humanise = (s: string) => {
	const words = s.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A timestamp in UTC: "2026-10-28 00:50 UTC". */
export const stamp = (iso: string) =>
	`${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
