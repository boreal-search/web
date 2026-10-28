// Pure helpers for rendering an engine answer. `answer.text` is model output: callers render
// the segments as text, never as HTML.
import type {
	Answer,
	Citation,
	CitationStatus,
	Highlight,
	SearchResult
} from '#lib/server/engine.types.js';

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

/** A run of the summary: one cited sentence (its `sentence.status`), or text outside any (null). */
export interface AnswerSentence {
	status: CitationStatus | null;
	segments: AnswerSegment[];
}

function toMark(c: Citation, results: readonly Located[]): Mark | null {
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
		status: c.status
	};
}

const validSpan = (start: number, end: number, length: number) =>
	Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= length && start < end;

interface Marker {
	start: number;
	end: number;
	marks: Mark[];
}

/**
 * The markers in text order, from the citations' offsets (the engine's, not a re-parse of
 * `[n]`, so both agree on which marker is which). Citations sharing offsets are one grouped
 * marker; a marker overlapping the previous one, or with bad offsets, is dropped.
 */
function markers(answer: Pick<Answer, 'text' | 'citations'>, results: readonly Located[]) {
	const groups = new Map<string, Marker>();
	for (const c of answer.citations) {
		if (!validSpan(c.start, c.end, answer.text.length)) continue;
		const key = `${c.start}:${c.end}`;
		const group = groups.get(key) ?? { start: c.start, end: c.end, marks: [] };
		groups.set(key, group);
		const mark = toMark(c, results);
		if (mark && !group.marks.some((m) => m.ref === mark.ref)) group.marks.push(mark);
	}
	const out: Marker[] = [];
	for (const g of [...groups.values()].sort((a, b) => a.start - b.start)) {
		if (g.start >= (out.at(-1)?.end ?? 0)) out.push(g);
	}
	return out;
}

/** Segments of `text[from, to)`; markers must lie inside it. Refless markers stay text. */
function segmentsOf(text: string, inside: readonly Marker[], from: number, to: number) {
	const segments: AnswerSegment[] = [];
	const push = (t: string) => {
		if (!t) return;
		const last = segments.at(-1);
		if (last?.kind === 'text') last.text += t;
		else segments.push({ kind: 'text', text: t });
	};
	let at = from;
	for (const g of inside) {
		push(text.slice(at, g.start));
		if (g.marks.length > 0) segments.push({ kind: 'cite', marks: g.marks });
		else push(text.slice(g.start, g.end));
		at = g.end;
	}
	push(text.slice(at, to));
	return segments;
}

/**
 * Split answer text into text and markers. Markers whose refs are all outside the results stay
 * as plain text.
 */
export function answerSegments(
	answer: Pick<Answer, 'text' | 'citations'>,
	results: readonly Located[]
): AnswerSegment[] {
	return segmentsOf(answer.text, markers(answer, results), 0, answer.text.length);
}

/**
 * The summary as runs: each cited sentence (from `citation.sentence`, with its status) and the
 * text between them (status null), each split into segments. A marker that starts inside a
 * sentence belongs to it even if it runs past the sentence's end.
 */
export function answerSentences(
	answer: Pick<Answer, 'text' | 'citations'>,
	results: readonly Located[]
): AnswerSentence[] {
	const { text } = answer;
	const all = markers(answer, results);
	const spans = new Map<string, { start: number; end: number; status: CitationStatus }>();
	for (const { sentence: s } of answer.citations) {
		if (validSpan(s.start, s.end, text.length)) spans.set(`${s.start}:${s.end}`, { ...s });
	}
	const out: AnswerSentence[] = [];
	const run = (from: number, to: number, status: CitationStatus | null) => {
		if (from >= to) return;
		const inside = all.filter((m) => m.start >= from && m.start < to);
		const end = Math.max(to, inside.at(-1)?.end ?? to);
		out.push({ status, segments: segmentsOf(text, inside, from, end) });
		return end;
	};
	let at = 0;
	for (const s of [...spans.values()].sort((a, b) => a.start - b.start)) {
		if (s.start < at) continue; // overlaps the previous sentence
		at = run(at, s.start, null) ?? at;
		at = run(Math.max(at, s.start), s.end, s.status) ?? at;
	}
	run(at, text.length, null);
	return out;
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
 * How far a summary was checked against its pages (docs/ui.md, "Answer states"), counted in
 * sentences that carry a citation. `not_found`: the engine abstained. `not_checked`: the check
 * didn't run, or there was nothing to check; never treated as verified.
 */
export type AnswerCheck =
	| { state: 'not_found' }
	| { state: 'not_checked' }
	| {
			state: 'checked';
			/** Sentences whose cited pages support them. */
			verified: number;
			/** Sentences none of whose cited pages support them. */
			unsupported: number;
			/** Cited sentences. */
			total: number;
	  };

export function answerCheck(
	answer: Pick<Answer, 'abstained' | 'verification' | 'readout' | 'citations'>
): AnswerCheck {
	if (answer.abstained) return { state: 'not_found' };
	const { sentences, sentences_verified } = answer.readout;
	if (answer.verification === null || sentences === 0) return { state: 'not_checked' };
	const unsupported = new Set(
		answer.citations
			.filter((c) => c.sentence.status === 'unsupported')
			.map((c) => `${c.sentence.start}:${c.sentence.end}`)
	).size;
	return { state: 'checked', verified: sentences_verified, unsupported, total: sentences };
}

/** The one-line status shown with a summary. */
export function answerCheckLabel(check: AnswerCheck): string {
	if (check.state === 'not_found') return 'Not found in the pages searched';
	if (check.state === 'not_checked') return 'Not checked';
	return `${check.verified} of ${check.total} ${check.total === 1 ? 'sentence' : 'sentences'} verified`;
}
