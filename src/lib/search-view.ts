// Pure helpers for the search results view (docs/ui.md, "Results view").
import type { AnswerCheck } from './answer.js';
import type { StepResult } from './trail.js';

export type FlagState = 'verified' | 'unsupported' | 'not_checked' | 'not_found';

/**
 * The `.flag` state for a summary's one status line: any unsupported sentence marks the whole
 * summary; verified only when every sentence is ("green is earned"); else not checked.
 */
export function checkFlag(check: AnswerCheck): FlagState {
	if (check.state !== 'checked') return check.state;
	if (check.unsupported > 0) return 'unsupported';
	return check.verified === check.total ? 'verified' : 'not_checked';
}

/** Section paths longer than this (characters) are shortened from the left. */
const SECTION_MAX = 48;
const SECTION_SEP = ' › ';

/**
 * A result's locator as pieces to join with " · ": document title, section (long paths keep
 * their last segments, prefixed "…"; one over-long segment is cut at the end), and page,
 * which is never dropped: ["Species at Risk Act", "…Interpretation › Sections 4-7", "P.12"].
 */
export function locator(
	r: Pick<StepResult, 'document_title' | 'section' | 'page_number'>,
	max = SECTION_MAX
): string[] {
	return [
		r.document_title,
		...(r.section ? [shortSection(r.section, max)] : []),
		`P.${r.page_number}`
	];
}

function shortSection(section: string, max: number) {
	const parts = section.split(SECTION_SEP).filter((p) => p.trim() !== '');
	let kept = [parts.at(-1) ?? section];
	for (let i = parts.length - 2; i >= 0; i--) {
		const next = [parts[i], ...kept];
		if (next.join(SECTION_SEP).length > max) break;
		kept = next;
	}
	let out = kept.join(SECTION_SEP);
	if (out.length > max) out = `${out.slice(0, max - 1).trimEnd()}…`;
	return kept.length < parts.length ? `…${out}` : out;
}

/** Milliseconds as a seconds reading: 746 → "0.7", 12_340 → "12.3". */
export const seconds = (ms: number) => (Math.max(0, ms) / 1000).toFixed(1);

/** Sum of known page counts, or null if any is unknown (engine listing failed). */
export function pagesSearched(pages: (number | null)[]): number | null {
	let total = 0;
	for (const p of pages) {
		if (p === null) return null;
		total += p;
	}
	return total;
}

/** True when a key press should go to the element (typing, or a control that uses keys). */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!target || typeof target !== 'object' || !('tagName' in target)) return false;
	const el = target as { tagName: string; isContentEditable?: boolean };
	return (
		['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName.toUpperCase()) ||
		el.isContentEditable === true
	);
}

/** Move a selection by `delta` within 0..length-1, stopping at the ends. */
export const step = (index: number, delta: number, length: number) =>
	Math.min(Math.max(index + delta, 0), Math.max(length - 1, 0));

/** Documents across a step's data sources, for "Search all N documents"; null if any is unknown. */
export function documentsIn(
	dataSourceIds: readonly string[],
	sources: readonly { id: string; documents: number | null }[]
): number | null {
	let total = 0;
	for (const id of dataSourceIds) {
		const n = sources.find((ds) => ds.id === id)?.documents;
		if (n === null || n === undefined) return null;
		total += n;
	}
	return total;
}

/** The "Results" field as a request's `top_k`: a whole number in 1..50, 10 when empty. */
export const topKValue = (topK: number) => Math.min(50, Math.max(1, Math.round(topK || 10)));

/** Why a page render can't be shown: no signing, an expired engine URL, or none kept. */
export const missingText = (
	r: Pick<StepResult, 'page_image_url'>,
	permanentLinks: boolean
): string =>
	permanentLinks
		? "Page image couldn't be loaded."
		: r.page_image_url
			? 'Page image expired. Search again to refresh.'
			: "Page images aren't kept with the trail. Open the PDF at this page.";

/** A result's snippet as a quoted excerpt: whitespace collapsed, ellipses either side. */
export const snippetText = (s: string) => `…${s.replace(/\s+/g, ' ').trim()}…`;
