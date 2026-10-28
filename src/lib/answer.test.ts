import { describe, expect, it } from 'vitest';
import {
	answerCheck,
	answerCheckLabel,
	answerMarks,
	answerSegments,
	claimMark,
	cleanBoxes,
	pageOutlines,
	resultAnchorId,
	type Mark
} from './answer';
import type { Citation, Highlight } from '#lib/server/engine.types.js';

const results = [
	{ document_id: 'doc-a', page_number: 13 },
	{ document_id: 'doc-b', page_number: 23 }
];
const line: [number, number, number, number] = [0.1, 0.4, 0.9, 0.42];

/** A citation of `marker` (its first occurrence in `text`), on result `ref`'s page. */
function cite(
	text: string,
	marker: string,
	ref: number,
	highlight: Partial<Highlight> = {},
	at: Partial<Citation> = {}
): Citation {
	const start = text.indexOf(marker);
	const r = results[ref - 1] ?? { document_id: 'doc-x', page_number: 1 };
	return {
		ref,
		start,
		end: start + marker.length,
		text: 'cited sentence',
		document_id: r.document_id,
		page_number: r.page_number,
		highlight: { kind: 'text', boxes: [line], quote: 'page words', ...highlight },
		sentence: { start: 0, end: start, status: 'not_checked' },
		status: 'not_checked',
		...at
	};
}

describe('answerSegments', () => {
	it('splits on the citation offsets and carries the boxes', () => {
		const text = 'A is required [1]. B too [2].';
		const segs = answerSegments(
			{ text, citations: [cite(text, '[1]', 1), cite(text, '[2]', 2, { kind: 'table' })] },
			results
		);
		expect(segs.map((s) => (s.kind === 'text' ? s.text : s.marks.map((m) => m.ref)))).toEqual([
			'A is required ',
			[1],
			'. B too ',
			[2],
			'.'
		]);
		expect(answerMarks(segs)).toEqual([
			{
				ref: 1,
				kind: 'text',
				boxes: [line],
				quote: 'page words',
				text: 'cited sentence',
				status: 'not_checked'
			},
			{
				ref: 2,
				kind: 'table',
				boxes: [line],
				quote: 'page words',
				text: 'cited sentence',
				status: 'not_checked'
			}
		]);
	});

	it('uses offsets, not the brackets in the text', () => {
		const text = 'See [1] and [1].';
		const second = text.lastIndexOf('[1]');
		const segs = answerSegments(
			{ text, citations: [cite(text, '[1]', 1, {}, { start: second, end: second + 3 })] },
			results
		);
		expect(segs[0]).toEqual({ kind: 'text', text: 'See [1] and ' });
		expect(segs[1]?.kind).toBe('cite');
	});

	it('groups citations that share a marker', () => {
		const text = 'Both [1, 2].';
		const segs = answerSegments(
			{ text, citations: [cite(text, '[1, 2]', 1), cite(text, '[1, 2]', 2)] },
			results
		);
		expect(segs[1]).toMatchObject({ kind: 'cite', marks: [{ ref: 1 }, { ref: 2 }] });
	});

	it('opens the page unmarked for kind page, ignoring any boxes', () => {
		const text = 'x [1]';
		const [m] = answerMarks(
			answerSegments({ text, citations: [cite(text, '[1]', 1, { kind: 'page' })] }, results)
		);
		expect(m).toMatchObject({ ref: 1, kind: 'page', boxes: [], quote: null });
	});

	it('never draws boxes on a page other than the one cited', () => {
		const text = 'x [1]';
		const c = cite(text, '[1]', 1, {}, { page_number: 14 });
		const [m] = answerMarks(answerSegments({ text, citations: [c] }, results));
		expect(m).toMatchObject({ ref: 1, kind: 'page', boxes: [] });
	});

	it('is a page mark when every box is unusable', () => {
		const text = 'x [1]';
		const c = cite(text, '[1]', 1, { kind: 'region', boxes: [[0.5, 0.5, 0.5, 0.9]] });
		expect(answerMarks(answerSegments({ text, citations: [c] }, results))[0]?.kind).toBe('page');
	});

	it('keeps markers with refs outside the results, or bad offsets, as text', () => {
		const text = 'x [3] y [1] z';
		const segs = answerSegments(
			{
				text,
				citations: [
					cite(text, '[3]', 3),
					cite(text, '[1]', 1, {}, { start: 40, end: 43 }),
					cite(text, '[1]', 1, {}, { start: 9, end: 8 })
				]
			},
			results
		);
		expect(segs).toEqual([{ kind: 'text', text }]);
	});

	it('is plain text with no citations (abstained)', () => {
		expect(answerSegments({ text: 'Not found [1]', citations: [] }, results)).toEqual([
			{ kind: 'text', text: 'Not found [1]' }
		]);
		expect(answerSegments({ text: '', citations: [] }, results)).toEqual([]);
	});

	it('anchors match result positions', () => {
		expect(resultAnchorId(1)).toBe('result-1');
	});
});

describe('cleanBoxes', () => {
	it('clamps to the page and drops degenerate or malformed boxes', () => {
		expect(
			cleanBoxes([
				[-0.1, 0.2, 1.3, 0.25],
				[0.3, 0.3, 0.3, 0.4],
				[0.6, 0.5, 0.2, 0.6],
				[0.1, Number.NaN, 0.2, 0.3],
				[0.1, 0.2, 0.3],
				[1.2, 0.1, 1.5, 0.2]
			])
		).toEqual([[0, 0.2, 1, 0.25]]);
	});
});

describe('pageOutlines', () => {
	const mark = (ref: number, boxes: Mark['boxes'], status: Mark['status']): Mark => ({
		ref,
		kind: 'text',
		boxes,
		quote: null,
		text: '',
		status
	});
	it('unions the boxes cited on one page, once each, with their status', () => {
		const other: [number, number, number, number] = [0.1, 0.5, 0.2, 0.6];
		const marks = [
			mark(1, [line], 'verified'),
			mark(2, [other], 'unsupported'),
			mark(1, [line, other], 'not_checked')
		];
		expect(pageOutlines(marks, 1)).toEqual([
			{ box: line, status: 'verified' },
			{ box: other, status: 'not_checked' }
		]);
		expect(pageOutlines(marks, 3)).toEqual([]);
	});
});

describe('citation status', () => {
	const text = 'Fines reach $1 million [1]. Notice is required [2].';
	const statuses = (citations: Citation[]) =>
		answerMarks(answerSegments({ text, citations }, results)).map((m) => m.status);

	it("is the engine's status for each citation", () => {
		expect(
			statuses([
				cite(text, '[1]', 1, {}, { status: 'verified' }),
				cite(text, '[2]', 2, {}, { status: 'unsupported' })
			])
		).toEqual(['verified', 'unsupported']);
	});

	it('is not checked when an older engine sends none, never verified', () => {
		const old: Partial<Citation> = cite(text, '[1]', 1);
		delete old.status;
		expect(statuses([old as Citation])).toEqual(['not_checked']);
	});
});

describe('claimMark', () => {
	const marks: Mark[] = [
		{
			ref: 1,
			kind: 'text',
			boxes: [line],
			quote: null,
			text: 'Fines reach $1 million',
			status: 'verified'
		},
		{ ref: 2, kind: 'page', boxes: [], quote: null, text: 'Notice is required', status: 'verified' }
	];
	it('finds the mark whose sentence is the claim, on the same ref', () => {
		expect(claimMark({ text: ' fines reach  $1 million ', ref: 1 }, marks)).toBe(marks[0]);
		expect(claimMark({ text: 'Fines reach $1 million', ref: 2 }, marks)).toBeNull();
	});
	it('never guesses another sentence from the same source', () => {
		expect(claimMark({ text: 'Something else', ref: 1 }, marks)).toBeNull();
		expect(claimMark({ text: 'Notice is required', ref: null }, marks)).toBeNull();
	});
});

describe('answerCheck', () => {
	const claim = (supported: boolean, ref: number | null = 1) => ({ claim: 'c', supported, ref });

	it('is not found when the engine abstained, whatever the verifier said', () => {
		const check = answerCheck({
			abstained: true,
			verification: { supported: 1, total: 1, claims: [claim(true)] }
		});
		expect(check).toEqual({ state: 'not_found' });
		expect(answerCheckLabel(check)).toBe('Not found in the pages searched');
	});

	it('is not checked, never verified, when the verifier did not run', () => {
		const check = answerCheck({ abstained: false, verification: null });
		expect(check).toEqual({ state: 'not_checked' });
		expect(answerCheckLabel(check)).toBe('Not checked');
	});

	it('is not checked when no claims were checked', () => {
		expect(
			answerCheck({ abstained: false, verification: { supported: 0, total: 0, claims: [] } }).state
		).toBe('not_checked');
	});

	it('marks each claim verified or unsupported', () => {
		const check = answerCheck({
			abstained: false,
			verification: { supported: 1, total: 2, claims: [claim(true), claim(false, null)] }
		});
		expect(check).toEqual({
			state: 'checked',
			claims: [
				{ text: 'c', state: 'verified', ref: 1 },
				{ text: 'c', state: 'unsupported', ref: null }
			]
		});
		expect(answerCheckLabel(check)).toBe('1 of 2 claims verified');
	});
});
