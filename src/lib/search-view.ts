// Pure helpers for the search results view (docs/ui.md, "Results view").
import type { AnswerCheck } from './answer.js';

export type FlagState = 'verified' | 'unsupported' | 'not_checked' | 'not_found';

/** The `.flag` state for an answer's one status line: any unsupported claim marks the whole answer. */
export function checkFlag(check: AnswerCheck): FlagState {
	if (check.state !== 'checked') return check.state;
	return check.claims.some((c) => c.state === 'unsupported') ? 'unsupported' : 'verified';
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
