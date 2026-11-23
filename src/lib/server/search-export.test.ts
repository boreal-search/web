import { describe, expect, it } from 'vitest';
import { answer } from '#lib/trail.fixture.js';
import type { Json } from '#lib/supabase/types.js';
import {
	EXPORT_TAIL,
	exportEntry,
	exportHead,
	exportedSearch,
	type ExportRow
} from './search-export';

const row = (over: Partial<ExportRow> = {}): ExportRow & { status: 'ok' } => ({
	id: 'e1',
	created_at: '2026-11-21T10:00:00+00:00',
	user_email: 'a@example.com',
	org_id: null,
	org_name: null,
	query: 'chinook residual effects',
	resolved_query: 'chinook residual effects',
	data_source_ids: ['kettle'],
	error: null,
	result_count: 2,
	retrieval_ms: 400,
	total_ms: 3400,
	trail_id: 't1',
	step_n: 1,
	answer: null,
	results: null,
	rating: null,
	note: null,
	rated_by: null,
	trail_rating: null,
	trail_note: null,
	engine_version: '2.0',
	plan: null,
	...over,
	status: 'ok'
});

const result = (page: number, extra: object = {}) => ({
	document_id: 'vol3',
	document_title: 'Vol 3',
	data_source_id: 'kettle',
	page_number: page,
	section: '12.6',
	...extra
});

describe('exportedSearch', () => {
	it('ranks results and leaves score and facets null on rows kept before they were', () => {
		const s = exportedSearch(
			row({ results: [result(412, { score: 0.9, facets: [0] }), result(431)] as Json })
		);
		expect(s.results).toEqual([
			{ ...result(412), rank: 1, score: 0.9, facets: [0] },
			{ ...result(431), rank: 2, score: null, facets: null }
		]);
		expect(s).toMatchObject({ engine_version: '2.0', context: 'Public', total_ms: 3400 });
		expect(s.created_at).toBe('2026-11-21T10:00:00.000Z');
	});

	it('maps each citation to its sentence, page, quote and check, marking cross-reference pages', () => {
		const a = answer({
			sources: [
				{ ref: 1, document_id: 'vol3', page_number: 412 },
				{ ref: 2, document_id: 'vol3', page_number: 431, via_xref: true }
			]
		});
		const s = exportedSearch(row({ answer: a as unknown as Json }));
		expect(s.answer?.citations).toEqual([
			{
				ref: 1,
				answer_text: 'Low-magnitude residual effect after offsetting 2.4 ha',
				document_id: 'vol3',
				page_number: 412,
				via_xref: false,
				source_quote: '…predicted to be low in magnitude…',
				status: 'verified'
			},
			{
				ref: 2,
				answer_text: 'Rated not significant',
				document_id: 'vol3',
				page_number: 431,
				via_xref: true,
				source_quote: null,
				status: 'verified'
			}
		]);
		expect(s.answer).toMatchObject({ text: a.text, model: 'm', generation_ms: 2000 });
	});

	it('names the org context and nests both ratings', () => {
		const s = exportedSearch(
			row({
				org_id: 'o1',
				org_name: 'Acme',
				rating: 'bad',
				note: 'wrong page',
				rated_by: 'r@x',
				trail_rating: 'good'
			})
		);
		expect(s.context).toBe('Acme');
		expect(s.ratings).toEqual({
			search: { rating: 'bad', note: 'wrong page', by: 'r@x' },
			trail: { rating: 'good', note: null }
		});
	});
});

describe('the export file', () => {
	it('is one JSON object keyed by search id', () => {
		const text =
			exportHead({ view: '?status=ok' }, '2026-11-21T12:00:00.000Z') +
			exportEntry(row(), true) +
			exportEntry(row({ id: 'e2' }), false) +
			EXPORT_TAIL;
		const file = JSON.parse(text);
		expect(file).toMatchObject({
			format: 'boreal-searches/1',
			exported_at: '2026-11-21T12:00:00.000Z',
			view: '?status=ok'
		});
		expect(Object.keys(file.searches)).toEqual(['e1', 'e2']);
	});

	it('is valid with no searches', () => {
		const file = JSON.parse(exportHead({ selected: 0 }, 'now') + EXPORT_TAIL);
		expect(file).toEqual({
			format: 'boreal-searches/1',
			exported_at: 'now',
			selected: 0,
			searches: {}
		});
	});
});
