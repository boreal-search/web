// Pure helpers for rendering an engine answer. `answer.text` is model output, and markdown:
// `answerBlocks` parses it into a small tree of our own types that callers render as elements
// and text, never as HTML (`{@html}`).
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';
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
 * A piece of the summary's text: part of one cited sentence (`sentence`, its index in the
 * answer, with its status) or of the text outside any (both null). A sentence that spans
 * several inline nodes (`**bold**`, say) is several pieces.
 */
export interface AnswerRun {
	kind: 'run';
	status: CitationStatus | null;
	sentence: number | null;
	/** The sentence's last piece: where a note about the whole sentence goes. */
	last: boolean;
	segments: AnswerSegment[];
}

export type AnswerInline =
	| AnswerRun
	| { kind: 'break' }
	| { kind: 'strong' | 'emphasis' | 'code'; children: AnswerInline[] };

/** The summary's markdown, reduced to what the summary shows: paragraphs, lists and code. */
export type AnswerBlock =
	| { kind: 'paragraph'; children: AnswerInline[] }
	/** Preformatted code: whitespace kept, markers in it left as text. `lang`: the fence's tag. */
	| { kind: 'code'; lang: string | null; children: AnswerRun[] }
	| { kind: 'list'; ordered: boolean; start: number | null; items: AnswerBlock[][] };

/** `text[from, to)`: one cited sentence, or text outside any (status and sentence null). */
interface Span {
	from: number;
	to: number;
	status: CitationStatus | null;
	sentence: number | null;
}

/**
 * The text cut into its cited sentences (`citation.sentence`) and the text between, covering
 * all of it. A marker that starts inside a span belongs to it even if it runs past its end, so
 * no marker straddles a cut. A sentence overlapping the previous one is dropped.
 */
function spans(answer: Pick<Answer, 'text' | 'citations'>, all: readonly Marker[]): Span[] {
	const { text } = answer;
	const sentences = new Map<string, { start: number; end: number; status: CitationStatus }>();
	for (const { sentence: s } of answer.citations) {
		if (validSpan(s.start, s.end, text.length)) sentences.set(`${s.start}:${s.end}`, { ...s });
	}
	const out: Span[] = [];
	const span = (
		from: number,
		to: number,
		status: CitationStatus | null,
		sentence: number | null
	) => {
		if (from >= to) return undefined;
		const inside = all.filter((m) => m.start >= from && m.start < to);
		const end = Math.max(to, inside.at(-1)?.end ?? to);
		out.push({ from, to: end, status, sentence });
		return end;
	};
	let at = 0;
	let n = 0;
	for (const s of [...sentences.values()].sort((a, b) => a.start - b.start)) {
		if (s.start < at) continue;
		at = span(at, s.start, null, null) ?? at;
		at = span(Math.max(at, s.start), s.end, s.status, n++) ?? at;
	}
	span(at, text.length, null, null);
	return out;
}

/**
 * Where each character of a node's `value` sits in `text[from, to)`. The value is that source
 * with syntax taken out (escape backslashes, list indentation, code backticks), so each value
 * character is matched to the next equal source character. Null when that fails (an entity like
 * `&#42;` decodes to a character the source doesn't have): the caller then shows the value as
 * plain text, with any markers in it left as text.
 */
function sourceOffsets(text: string, from: number, to: number, value: string): number[] | null {
	const out: number[] = [];
	let i = from;
	for (let j = 0; j < value.length; j++) {
		while (i < to && text[i] !== value[j]) i++;
		if (i >= to) return null;
		out.push(i++);
	}
	return out;
}

const OUTSIDE = { status: null, sentence: null } as const;
const plain = (t: string): AnswerSegment[] => (t ? [{ kind: 'text', text: t }] : []);

/** First index of the ascending `xs` holding a value >= `x`. */
function lowerBound(xs: readonly number[], x: number) {
	let lo = 0;
	let hi = xs.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (xs[mid]! < x) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** A fence's language tag, if it is a plain word (it is shown as a label, nothing more). */
const fenceLang = (lang: string | null | undefined) =>
	lang && /^[\w+#.-]{1,24}$/.test(lang) ? lang : null;

/**
 * The summary as blocks of minimal markdown (CommonMark: paragraphs, lists, strong, emphasis,
 * inline code, code blocks), its text cut into pieces at sentence edges, each with its
 * sentence's status and its markers. Model output is untrusted, so nothing else becomes markup:
 * headings read as bold paragraphs, quotes as their contents, links as their text (no hrefs),
 * and images, HTML, rules and definitions as their source text. A marker split across nodes, or
 * inside code, stays text. A code span alone on its line with a fence's backticks
 * (```` ``` make x ``` ````, which CommonMark reads as inline) is a code block.
 */
export function answerBlocks(
	answer: Pick<Answer, 'text' | 'citations'>,
	results: readonly Located[]
): AnswerBlock[] {
	const { text } = answer;
	const all = markers(answer, results);
	const cuts = spans(answer, all);
	const pieces: AnswerRun[] = [];
	const piece = (span: Pick<Span, 'status' | 'sentence'>, segments: AnswerSegment[]) => {
		const run: AnswerRun = { kind: 'run', ...span, last: false, segments };
		pieces.push(run);
		return run;
	};

	/** Pieces of a leaf whose `value` came from `text[from, to)`; `cite`: markers become links. */
	const leaf = (value: string, from: number, to: number, cite: boolean): AnswerRun[] => {
		const src =
			text.slice(from, to) === value
				? Array.from(value, (_, j) => from + j)
				: sourceOffsets(text, from, to, value);
		if (!src) {
			const span = cuts.find((s) => s.from <= from && from < s.to) ?? OUTSIDE;
			return [piece(span, plain(value))];
		}
		const out: AnswerRun[] = [];
		for (const span of cuts) {
			const a = lowerBound(src, span.from);
			const b = lowerBound(src, span.to);
			if (a >= b) continue;
			// Markers in value coordinates; one whose characters aren't contiguous there is text.
			const inside = !cite
				? []
				: all.flatMap((m) => {
						const k = lowerBound(src, m.start);
						const len = m.end - m.start;
						return k >= a && k + len <= b && src[k] === m.start && src[k + len - 1] === m.end - 1
							? [{ ...m, start: k, end: k + len }]
							: [];
					});
			out.push(piece(span, segmentsOf(value, inside, a, b)));
		}
		return out;
	};
	const offsets = (n: Nodes) => {
		const from = n.position?.start.offset;
		const to = n.position?.end.offset;
		return from === undefined || to === undefined ? null : ([from, to] as const);
	};
	/** A node's source text, shown as is. */
	const raw = (n: Nodes): AnswerRun[] => {
		const at = offsets(n);
		return at && at[0] < at[1] ? leaf(text.slice(...at), ...at, false) : [];
	};
	const value = (n: Nodes & { value: string }, cite: boolean): AnswerRun[] => {
		const at = offsets(n);
		return at ? leaf(n.value, ...at, cite) : [piece(OUTSIDE, plain(n.value))];
	};

	const inline = (n: Nodes): AnswerInline[] => {
		switch (n.type) {
			case 'text':
				return value(n, true);
			case 'strong':
			case 'emphasis':
				return [{ kind: n.type, children: n.children.flatMap(inline) }];
			case 'inlineCode':
				return [{ kind: 'code', children: value(n, false) }];
			case 'break':
				return [{ kind: 'break' }];
			case 'link':
			case 'linkReference':
				return n.children.flatMap(inline);
			default:
				return raw(n);
		}
	};
	/** A ```-span with nothing else on its line (within the paragraph `p`). */
	const ownLine = (n: Nodes, p: readonly [number, number]) => {
		const at = offsets(n);
		if (n.type !== 'inlineCode' || !at || !text.startsWith('```', at[0])) return false;
		const lineStart = text.lastIndexOf('\n', at[0] - 1) + 1;
		const lineEnd = text.indexOf('\n', at[1]);
		return (
			text.slice(Math.max(lineStart, p[0]), at[0]).trim() === '' &&
			text.slice(at[1], Math.min(lineEnd < 0 ? text.length : lineEnd, p[1])).trim() === ''
		);
	};
	const blank = (xs: AnswerInline[]) =>
		xs.every(
			(x) => x.kind === 'run' && x.segments.every((s) => s.kind === 'text' && !s.text.trim())
		);
	/** A paragraph, split around its own-line ```-spans. */
	const paragraph = (n: Nodes & { type: 'paragraph' }): AnswerBlock[] => {
		const at = offsets(n);
		const out: AnswerBlock[] = [];
		let children: AnswerInline[] = [];
		const flush = () => {
			if (!blank(children)) out.push({ kind: 'paragraph', children });
			children = [];
		};
		for (const c of n.children) {
			if (at && c.type === 'inlineCode' && ownLine(c, at)) {
				flush();
				out.push({ kind: 'code', lang: null, children: value(c, false) });
			} else children.push(...inline(c));
		}
		flush();
		return out;
	};
	const block = (n: Nodes): AnswerBlock[] => {
		switch (n.type) {
			case 'paragraph':
				return paragraph(n);
			case 'code': {
				const at = offsets(n);
				// A fenced block's value starts after its opening line (the fence and its tag).
				const fenced = at !== null && /^\s*(`{3,}|~{3,})/.test(text.slice(...at));
				const from = at && fenced ? text.indexOf('\n', at[0]) + 1 || at[1] : at?.[0];
				const children =
					at && from !== undefined
						? leaf(n.value, from, at[1], false)
						: [piece(OUTSIDE, plain(n.value))];
				return [{ kind: 'code', lang: fenceLang(n.lang), children }];
			}
			case 'heading':
				return [
					{
						kind: 'paragraph',
						children: [{ kind: 'strong', children: n.children.flatMap(inline) }]
					}
				];
			case 'blockquote':
				return n.children.flatMap(block);
			case 'list':
				return [
					{
						kind: 'list',
						ordered: n.ordered === true,
						start: n.ordered ? (n.start ?? 1) : null,
						items: n.children.map((item) => item.children.flatMap(block))
					}
				];
			default: {
				const children = raw(n);
				return children.length > 0 ? [{ kind: 'paragraph', children }] : [];
			}
		}
	};

	const blocks = fromMarkdown(text).children.flatMap(block);
	const lastOf = new Map<number, AnswerRun>();
	for (const p of pieces) if (p.sentence !== null) lastOf.set(p.sentence, p);
	for (const p of lastOf.values()) p.last = true;
	return blocks;
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
