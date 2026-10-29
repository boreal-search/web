import { describe, expect, it } from 'vitest';
import {
	answerCheck,
	answerCheckLabel,
	answerMarks,
	answerBlocks,
	answerSegments,
	cleanBoxes,
	pageOutlines,
	resultAnchorId,
	type AnswerBlock,
	type AnswerInline,
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
});

describe('answerBlocks', () => {
	/** The tree as a compact string: `{status|text|end}` a sentence piece (`end`: its last). */
	const show = (blocks: AnswerBlock[]): string[] => blocks.map(showBlock);
	const showBlock = (b: AnswerBlock): string =>
		b.kind === 'paragraph'
			? `p(${b.children.map(showInline).join('')})`
			: `${b.ordered ? `ol${b.start}` : 'ul'}(${b.items.map((i) => `li(${i.map(showBlock).join('')})`).join('')})`;
	const showInline = (n: AnswerInline): string => {
		if (n.kind === 'break') return '\\n';
		if (n.kind === 'run') {
			const t = n.segments
				.map((s) =>
					s.kind === 'text' ? s.text : `[${s.marks.map((m) => `${m.ref}:${m.status}`).join(' ')}]`
				)
				.join('');
			return n.status === null ? t : `{${n.status}|${t}${n.last ? '|end' : ''}}`;
		}
		const inner = n.children.map(showInline).join('');
		return n.kind === 'strong'
			? `**${inner}**`
			: n.kind === 'emphasis'
				? `_${inner}_`
				: `\`${inner}\``;
	};
	/** Citation of `marker` in `text` for the sentence containing it, both with `status`. */
	const cited = (
		text: string,
		sentence: string,
		marker: string,
		ref: number,
		status: Citation['status']
	) => {
		const s = text.indexOf(sentence);
		const m = s + sentence.indexOf(marker);
		return cite(
			text,
			marker,
			ref,
			{},
			{
				start: m,
				end: m + marker.length,
				sentence: { start: s, end: s + sentence.length, status },
				status
			}
		);
	};
	/** No usable sentence: the marker stands outside any. */
	const NONE = { start: 0, end: 0, status: 'verified' } as const;
	const blocks = (text: string, citations: Citation[]) =>
		show(answerBlocks({ text, citations }, results));

	describe('plain prose', () => {
		// Two cited sentences with plain text before, between and after.
		const text = 'Intro. Fines reach $1 million [1]. Also [2]. Notice is required [1, 2]. End.';
		const span = (sentence: string) => {
			const start = text.indexOf(sentence);
			return { start, end: start + sentence.length };
		};
		const s1 = span('Fines reach $1 million [1].');
		const s2 = span('Notice is required [1, 2].');
		const citations = [
			cite(text, '[1]', 1, {}, { sentence: { ...s1, status: 'verified' }, status: 'verified' }),
			cite(text, '[2]', 2, {}, { sentence: NONE }),
			cite(
				text,
				'[1, 2]',
				1,
				{},
				{ sentence: { ...s2, status: 'verified' }, status: 'unsupported' }
			),
			cite(text, '[1, 2]', 2, {}, { sentence: { ...s2, status: 'verified' }, status: 'verified' })
		];

		it('is one paragraph of sentence pieces, with the text between them unmarked', () => {
			expect(blocks(text, citations)).toEqual([
				'p(Intro. ' +
					'{verified|Fines reach $1 million [1:verified].|end}' +
					// A marker whose sentence offsets are unusable still renders, outside any sentence.
					' Also [2:not_checked]. ' +
					'{verified|Notice is required [1:unsupported 2:verified].|end}' +
					' End.)'
			]);
		});

		it('has the same marks as the flat segments', () => {
			const runs = answerBlocks({ text, citations }, results).flatMap((b) =>
				b.kind === 'paragraph' ? b.children : []
			);
			const segments = runs.flatMap((r) => (r.kind === 'run' ? r.segments : []));
			expect(answerMarks(segments)).toEqual(
				answerMarks(answerSegments({ text, citations }, results))
			);
		});
	});

	it('keeps a marker with its sentence when it runs past the sentence end', () => {
		const t = 'Fines apply [1].';
		const c = cite(t, '[1]', 1, {}, { sentence: { start: 0, end: 13, status: 'unsupported' } });
		expect(blocks(t, [c])).toEqual(['p({unsupported|Fines apply [1:not_checked]|end}.)']);
	});

	it('is one unmarked paragraph when abstained', () => {
		expect(blocks('Not found in the pages searched.', [])).toEqual([
			'p(Not found in the pages searched.)'
		]);
		expect(blocks('', [])).toEqual([]);
	});

	it('renders bold, italic and code around and next to citations', () => {
		const t = 'Fines are **$1 million** [1]. *See* `s. 12` [2]. Also **[1]**.';
		const a = 'Fines are **$1 million** [1].';
		const b = '*See* `s. 12` [2].';
		const last = t.lastIndexOf('[1]');
		expect(
			blocks(t, [
				cited(t, a, '[1]', 1, 'unsupported'),
				cited(t, b, '[2]', 2, 'verified'),
				cite(t, '[1]', 1, {}, { start: last, end: last + 3, sentence: NONE })
			])
		).toEqual([
			'p({unsupported|Fines are }**{unsupported|$1 million}**{unsupported| [1:unsupported].|end} ' +
				'_{verified|See}_{verified| }`{verified|s. 12}`{verified| [2:verified].|end}' +
				' Also **[1:not_checked]**.)'
		]);
	});

	it('gives a sentence spanning a strong node its status on each piece, the end on the last', () => {
		const t = 'The fine is **at most $1 million** in total [1].';
		expect(blocks(t, [cited(t, t, '[1]', 1, 'unsupported')])).toEqual([
			'p({unsupported|The fine is }**{unsupported|at most $1 million}**{unsupported| in total [1:unsupported].|end})'
		]);
	});

	it('renders a bullet list with citations in its items', () => {
		const t = 'Two rules:\n\n- Fines apply [1].\n- Notice is due\n  in writing [2].';
		const a = 'Fines apply [1].';
		const b = 'Notice is due\n  in writing [2].';
		expect(
			blocks(t, [cited(t, a, '[1]', 1, 'verified'), cited(t, b, '[2]', 2, 'unsupported')])
		).toEqual([
			'p(Two rules:)',
			'ul(li(p({verified|Fines apply [1:verified].|end}))' +
				// The item's continuation indent isn't text, but the marker after it still links.
				'li(p({unsupported|Notice is due\nin writing [2:unsupported].|end})))'
		]);
	});

	it('keeps an ordered list start', () => {
		expect(blocks('3. three\n4. four', [])).toEqual(['ol3(li(p(three))li(p(four)))']);
	});

	it('keeps markers after an escaped character', () => {
		const t = 'A \\*star\\* rule [1].';
		expect(blocks(t, [cited(t, t, '[1]', 1, 'verified')])).toEqual([
			'p({verified|A *star* rule [1:verified].|end})'
		]);
	});

	it('shows a text node it cannot place in the source as plain text', () => {
		const t = 'A &#42; rule [1].';
		expect(blocks(t, [cited(t, t, '[1]', 1, 'verified')])).toEqual([
			'p({verified|A * rule [1].|end})'
		]);
	});

	it('shows a link as its text only', () => {
		const t = 'See [the act](https://evil.example/x) [1].';
		const out = answerBlocks({ text: t, citations: [cited(t, t, '[1]', 1, 'verified')] }, results);
		expect(show(out)).toEqual([
			'p({verified|See }{verified|the act}{verified| [1:verified].|end})'
		]);
		expect(JSON.stringify(out)).not.toContain('evil');
	});

	it('drops a marker that crosses a node boundary to text', () => {
		const t = 'A rule *[1]* applies.';
		const at = t.indexOf('*[1]');
		expect(blocks(t, [cite(t, '[1]', 1, {}, { start: at, end: at + 4, sentence: NONE })])).toEqual([
			'p(A rule _[1]_ applies.)'
		]);
	});

	it('renders partial markdown as text, markers still linked', () => {
		const t = '**unclosed [1]';
		expect(blocks(t, [cited(t, t, '[1]', 1, 'verified')])).toEqual([
			'p({verified|**unclosed [1:verified]|end})'
		]);
	});

	it('shows headings as bold paragraphs and other constructs as their source text', () => {
		const t = '# Title\n\n> quoted [1]\n\n```\ncode\n```\n\n<b>x</b>\n\n![img](y)\n\n---';
		const at = t.indexOf('[1]');
		expect(blocks(t, [cite(t, '[1]', 1, {}, { start: at, end: at + 3, sentence: NONE })])).toEqual([
			'p(**Title**)',
			'p(quoted [1:not_checked])',
			'p(```\ncode\n```)',
			'p(<b>x</b>)',
			'p(![img](y))',
			'p(---)'
		]);
	});
});

describe('answerCheck', () => {
	const readout = (sentences: number, sentences_verified: number) => ({
		pages_used: 1,
		sentences,
		sentences_verified,
		generation_ms: 1,
		verify_ms: 1,
		total_ms: 2
	});
	const verification = { supported: 0, total: 0, claims: [] };
	const unsupportedSentence = cite(
		'x [1]',
		'[1]',
		1,
		{},
		{
			sentence: { start: 0, end: 5, status: 'unsupported' }
		}
	);

	it('is not found when the engine abstained, whatever the check said', () => {
		const check = answerCheck({
			abstained: true,
			verification,
			readout: readout(1, 1),
			citations: []
		});
		expect(check).toEqual({ state: 'not_found' });
		expect(answerCheckLabel(check)).toBe('Not found in the pages searched');
	});

	it('is not checked, never verified, when the check did not run', () => {
		const check = answerCheck({
			abstained: false,
			verification: null,
			readout: readout(2, 0),
			citations: []
		});
		expect(check).toEqual({ state: 'not_checked' });
		expect(answerCheckLabel(check)).toBe('Not checked');
	});

	it('is not checked when no sentence carries a citation', () => {
		expect(
			answerCheck({ abstained: false, verification, readout: readout(0, 0), citations: [] }).state
		).toBe('not_checked');
	});

	it('counts verified and unsupported sentences', () => {
		const check = answerCheck({
			abstained: false,
			verification,
			readout: readout(2, 1),
			citations: [unsupportedSentence, unsupportedSentence]
		});
		expect(check).toEqual({ state: 'checked', verified: 1, unsupported: 1, total: 2 });
		expect(answerCheckLabel(check)).toBe('1 of 2 sentences verified');
		expect(answerCheckLabel({ state: 'checked', verified: 1, unsupported: 0, total: 1 })).toBe(
			'1 of 1 sentence verified'
		);
	});
});
