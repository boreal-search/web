// Pure helpers for rendering an engine answer. `answer.text` is model output: callers render
// the segments as text, never as HTML.
import type { Answer } from '#lib/server/engine.types.js';

export type AnswerSegment = { kind: 'text'; text: string } | { kind: 'cite'; ref: number };

/** DOM id of result card n (1-based), the target of citation `[n]`. */
export const resultAnchorId = (ref: number) => `result-${ref}`;

/**
 * Split answer text on `[n]` citations. `[n]` refers to results[n-1]; refs outside
 * 1..resultCount stay as plain text so we never link to a missing card.
 */
export function splitCitations(text: string, resultCount: number): AnswerSegment[] {
	const segments: AnswerSegment[] = [];
	const push = (t: string) => {
		if (!t) return;
		const last = segments.at(-1);
		if (last?.kind === 'text') last.text += t;
		else segments.push({ kind: 'text', text: t });
	};
	// With a capture group, split alternates text / ref / text / ref ...
	text.split(/\[(\d+)\]/).forEach((part, i) => {
		if (i % 2 === 0) return push(part);
		const ref = Number(part);
		if (Number.isInteger(ref) && ref >= 1 && ref <= resultCount)
			segments.push({ kind: 'cite', ref });
		else push(`[${part}]`);
	});
	return segments;
}

/**
 * How far an answer was checked against its pages (docs/ui.md, "Answer states").
 * `not_found`: the engine abstained. `not_checked`: the verifier didn't run, its reply was
 * unparseable, or it found no claims; never treated as verified.
 */
export type AnswerCheck =
	{ state: 'not_found' } | { state: 'not_checked' } | { state: 'checked'; claims: CheckedClaim[] };

export interface CheckedClaim {
	text: string;
	state: 'verified' | 'unsupported';
	/** Cited result (1-based), if the claim carried one. */
	ref: number | null;
}

export function answerCheck(answer: Pick<Answer, 'abstained' | 'verification'>): AnswerCheck {
	if (answer.abstained) return { state: 'not_found' };
	const claims = answer.verification?.claims ?? [];
	if (claims.length === 0) return { state: 'not_checked' };
	return {
		state: 'checked',
		claims: claims.map((c) => ({
			text: c.claim,
			state: c.supported ? 'verified' : 'unsupported',
			ref: c.ref
		}))
	};
}

/** The one-line status shown with an answer. */
export function answerCheckLabel(check: AnswerCheck): string {
	if (check.state === 'not_found') return 'Not found in the pages searched';
	if (check.state === 'not_checked') return 'Not checked';
	const verified = check.claims.filter((c) => c.state === 'verified').length;
	return `${verified} of ${check.claims.length} claims verified`;
}
