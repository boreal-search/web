import { describe, expect, it } from 'vitest';
import { trailFileName, trailJson, trailMarkdown } from './trail-export.js';
import { applyEvent } from './trail.js';
import { answer, step } from './trail.fixture.js';

const meta = {
	title: 'What residual effects on Chinook habitat?',
	exported_at: '2026-10-28T21:02:00Z',
	email: 'reviewer@example.com',
	context: 'Kettle Ridge Review',
	origin: 'https://boreal.test'
};

const plan = { document_id: 'plan', title: 'Offsetting Plan' };

describe('trailMarkdown', () => {
	it('records each step: query, rewrite, scope, readout, checked summary and citations', () => {
		const steps = [
			step(2, {
				req: { query: 'Just the offsetting plan. How is the 2.4 ha made up?', from: 1 },
				resolved: 'How is the 2.4 ha of Chinook habitat offsetting made up?',
				inferred: [plan],
				answer: answer({
					abstained: true,
					text: 'Not found in the pages searched.',
					citations: []
				})
			}),
			step(1)
		];
		expect(trailMarkdown(meta, steps)).toBe(
			`Boreal Search trail: What residual effects on Chinook habitat?
Exported 2026-10-28 21:02 UTC · reviewer@example.com · Kettle Ridge Review

01  What residual effects on Chinook habitat?
    Scope: Kettle Ridge Application (14 documents) · indexed 2026-10-27
    2 pages · 1 PDF · 6,214 searched · 3.4 s · searched 2026-10-28 13:55 UTC
    Generated summary · 2 of 2 sentences verified
    Low-magnitude residual effect after offsetting 2.4 ha [1]. Rated not significant [2].
    [1] Vol 3 · §12.6 · p.412 · Verified · "…predicted to be low in magnitude…"
        https://boreal.test/pdf/kettle/vol3?page=412
    [2] Vol 3 · p.431 · Verified · "determined to be not significant"
        https://boreal.test/pdf/kettle/vol3?page=431

02  Just the offsetting plan. How is the 2.4 ha made up?
    Searched as: How is the 2.4 ha of Chinook habitat offsetting made up?
    Scope: Offsetting Plan (14 documents) · builds on 01 · indexed 2026-10-27
    2 pages · 1 PDF · 6,214 searched · 3.4 s · searched 2026-10-28 13:55 UTC
    Not found in the pages searched.
`
		);
	});

	it('lists the pages when there is no summary, and says why one is missing', () => {
		const s = applyEvent(step(1, { answer: null }), { type: 'timeout' }, null);
		const text = trailMarkdown(meta, [s]);
		expect(text).toContain(
			'    Summary not available: the search engine is busy, try again in a few minutes.\n' +
				'    1. Vol 3 · §12.6 · p.412 · "predicted to be low in magnitude"\n' +
				'        https://boreal.test/pdf/kettle/vol3?page=412\n'
		);
	});

	it('says when a citation is unsupported or not checked', () => {
		const a = answer();
		a.citations[0] = { ...a.citations[0]!, status: 'unsupported' };
		a.citations[1] = { ...a.citations[1]!, status: 'not_checked' };
		const text = trailMarkdown(meta, [step(1, { answer: a })]);
		expect(text).toMatch(/\[1\] Vol 3 · §12\.6 · p\.412 · Unsupported · /);
		expect(text).toMatch(/\[2\] Vol 3 · p\.431 · Not checked · /);
	});

	it('keeps the lines of a markdown summary', () => {
		const a = answer({ text: 'Two rules:\n\n- **Fines** apply [1].\n- Notice   is due [2].' });
		expect(trailMarkdown(meta, [step(1, { answer: a })])).toContain(
			'    Two rules:\n    - **Fines** apply [1].\n    - Notice is due [2].\n'
		);
	});
});

describe('trailJson', () => {
	it('is the full snapshots with permanent links and no signed URLs', () => {
		const parsed = JSON.parse(trailJson(meta, [step(1)]));
		expect(parsed).toMatchObject({
			format: 'boreal-trail/1',
			title: meta.title,
			email: meta.email,
			steps: [
				{
					n: 1,
					query: meta.title,
					answer: { abstained: false },
					results: [{ page_number: 412, pdf: 'https://boreal.test/pdf/kettle/vol3?page=412' }, {}]
				}
			]
		});
		expect(JSON.stringify(parsed)).not.toMatch(/sig=|page_image_url/);
	});
});

describe('trailFileName', () => {
	it('slugs the title and dates the file', () => {
		expect(trailFileName('Chinook habitat: 2.4 ha?', '2026-10-29T12:00:00Z', 'md')).toBe(
			'boreal-trail-chinook-habitat-2-4-ha-2026-10-29.md'
		);
	});
	it('falls back to "search" for a title with no letters or digits', () => {
		expect(trailFileName('—', '2026-10-29T12:00:00Z', 'json')).toBe(
			'boreal-trail-search-2026-10-29.json'
		);
	});
});
