// Pure helpers for rendering an engine answer. `answer.text` is model output: callers render
// the segments as text, never as HTML.
import type { Answer, CitationStatus, Highlight, SearchResult } from '#lib/server/engine.types.js';

/** `[x0, y0, x1, y1]` as fractions of the page from its top-left corner, each in 0..1. */
export type Box = readonly [number, number, number, number];

export type { CitationStatus };

/**
 * One `[n]` reference: result `ref` (1-based) and where on that result's page the cited text
 * is. No boxes means the text wasn't placed: open the page without a highlight.
 */
export interface Mark {
	ref: number;
	kind: Highlight['kind'];
	boxes: Box[];
	/** Page text that matched (text/table kinds), for tooltips and screen readers. */
	quote: string | null;
	/** The answer text this marker backs. */
	text: string;
	status: CitationStatus;
}

/** A box to outline on a page render, coloured by its citation's status. */
export interface Outline {
	box: Box;
	status: CitationStatus;
}

/** A run of answer text, or one marker (`[1]`, or `[1, 2]` with one mark per ref). */
export type AnswerSegment = { kind: 'text'; text: string } | { kind: 'cite'; marks: Mark[] };

/** DOM id of result card n (1-based), the target of citation `[n]`. */
export const resultAnchorId = (ref: number) => `result-${ref}`;

/** Boxes thinner than this (a page fraction, ~1 px on a 1000 px page) are dropped. */
const MIN_SIDE = 0.001;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Keep finite, in-page, non-degenerate boxes, clamped to the page. */
export function cleanBoxes(boxes: readonly (readonly number[])[]): Box[] {
	const out: Box[] = [];
	for (const b of boxes) {
		if (b.length !== 4 || !b.every(Number.isFinite)) continue;
		const [x0, y0, x1, y1] = b.map(clamp01);
		if (x1 - x0 < MIN_SIDE || y1 - y0 < MIN_SIDE) continue;
		out.push([x0, y0, x1, y1]);
	}
	return out;
}

type Located = Pick<SearchResult, 'document_id' | 'page_number'>;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** A checked claim and an answer sentence match: equal, or one contains the other. */
function sameSentence(a: string, b: string) {
	const x = norm(a);
	const y = norm(b);
	return x !== '' && y !== '' && (x === y || x.includes(y) || y.includes(x));
}

function toMark(c: Answer['citations'][number], results: readonly Located[]): Mark | null {
	const r = results[c.ref - 1];
	if (!Number.isInteger(c.ref) || !r) return null;
	// `[n]` is results[n-1]. Boxes for any other page don't fit the page we show: open it unmarked.
	const samePage = r.document_id === c.document_id && r.page_number === c.page_number;
	const boxes = samePage && c.highlight.kind !== 'page' ? cleanBoxes(c.highlight.boxes) : [];
	return {
		ref: c.ref,
		kind: boxes.length > 0 ? c.highlight.kind : 'page',
		boxes,
		quote: boxes.length > 0 ? c.highlight.quote : null,
		text: c.text,
		// The engine's check of this citation (older engines don't send it: not checked).
		status: c.status ?? 'not_checked'
	};
}

/**
 * Split answer text on its citations' offsets (the engine's, not a re-parse of `[n]`, so both
 * agree on which marker is which). Citations sharing offsets are one grouped marker. Markers
 * with bad offsets, or whose refs are all outside the results, stay as plain text.
 */
export function answerSegments(
	answer: Pick<Answer, 'text' | 'citations'>,
	results: readonly Located[]
): AnswerSegment[] {
	const { text } = answer;
	const groups = new Map<string, { start: number; end: number; marks: Mark[] }>();
	for (const c of answer.citations) {
		const { start, end } = c;
		if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length)
			continue;
		if (start >= end) continue;
		const key = `${start}:${end}`;
		const group = groups.get(key) ?? { start, end, marks: [] };
		groups.set(key, group);
		const mark = toMark(c, results);
		if (mark && !group.marks.some((m) => m.ref === mark.ref)) group.marks.push(mark);
	}
	const segments: AnswerSegment[] = [];
	const push = (t: string) => {
		if (!t) return;
		const last = segments.at(-1);
		if (last?.kind === 'text') last.text += t;
		else segments.push({ kind: 'text', text: t });
	};
	let at = 0;
	for (const g of [...groups.values()].sort((a, b) => a.start - b.start)) {
		if (g.start < at) continue; // overlaps the previous marker
		push(text.slice(at, g.start));
		if (g.marks.length > 0) segments.push({ kind: 'cite', marks: g.marks });
		else push(text.slice(g.start, g.end));
		at = g.end;
	}
	push(text.slice(at));
	return segments;
}

/** Every mark in the answer, in text order. */
export const answerMarks = (segments: readonly AnswerSegment[]): Mark[] =>
	segments.flatMap((s) => (s.kind === 'cite' ? s.marks : []));

/** A mark's boxes, each with the mark's status. */
export const markOutlines = (m: Mark): Outline[] =>
	m.boxes.map((box) => ({ box, status: m.status }));

/** Every box the answer cites on result `ref`'s page, once each (the first citation's status). */
export function pageOutlines(marks: readonly Mark[], ref: number): Outline[] {
	const seen = new Set<string>();
	const out: Outline[] = [];
	for (const o of marks.filter((m) => m.ref === ref).flatMap(markOutlines)) {
		const key = o.box.join(',');
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(o);
	}
	return out;
}

/**
 * The mark backing a checked claim: same ref, and its sentence matches the claim (equal, or
 * one contains the other). Otherwise null, even if the ref has other marks: never guess.
 */
export function claimMark(
	claim: { text: string; ref: number | null },
	marks: readonly Mark[]
): Mark | null {
	if (claim.ref === null) return null;
	return marks.find((m) => m.ref === claim.ref && sameSentence(m.text, claim.text)) ?? null;
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
