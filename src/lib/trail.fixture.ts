// Test fixtures for trail steps (imported by tests only).
import type { Answer, SearchResult } from '#lib/server/engine.types.js';
import { applyEvent, newStep, type StepRequest, type TrailStep } from './trail.js';

export const request = (over: Partial<StepRequest> = {}): StepRequest => ({
	query: 'What residual effects on Chinook habitat?',
	data_source_ids: ['kettle'],
	document_ids: null,
	rewrite: true,
	doc_filter: true,
	answer: true,
	top_k: 10,
	rerank: true,
	from: null,
	context: [],
	document_titles: {},
	trail_id: null,
	...over
});

export const result = (over: Partial<SearchResult> = {}): SearchResult => ({
	document_id: 'vol3',
	document_title: 'Vol 3',
	data_source_id: 'kettle',
	page_number: 412,
	section: '§12.6',
	score: 0.91,
	page_image_url: 'https://engine/files/p?sig=x',
	pdf_url: 'https://engine/files/d?sig=x#page=412',
	snippet: 'predicted to be low in magnitude',
	...over
});

export const readout = {
	pages_searched: 6214,
	documents_searched: 14,
	pages_returned: 2,
	retrieval_ms: 500,
	total_ms: 600
};

/** A two-sentence summary citing results 1 and 2, both verified. */
export const answer = (over: Partial<Answer> = {}): Answer => {
	const text =
		'Low-magnitude residual effect after offsetting 2.4 ha [1]. Rated not significant [2].';
	const at = (marker: string) => text.indexOf(marker);
	const s1 = { start: 0, end: at('[1]') + 4, status: 'verified' as const };
	const s2 = { start: at('Rated'), end: text.length, status: 'verified' as const };
	return {
		text,
		abstained: false,
		sources: [],
		citations: [
			{
				ref: 1,
				start: at('[1]'),
				end: at('[1]') + 3,
				text: 'Low-magnitude residual effect after offsetting 2.4 ha',
				sentence: s1,
				document_id: 'vol3',
				page_number: 412,
				status: 'verified',
				highlight: {
					kind: 'text',
					boxes: [[0.1, 0.2, 0.9, 0.25]],
					quote: '…predicted to be low in magnitude…'
				}
			},
			{
				ref: 2,
				start: at('[2]'),
				end: at('[2]') + 3,
				text: 'Rated not significant',
				sentence: s2,
				document_id: 'vol3',
				page_number: 431,
				status: 'verified',
				highlight: { kind: 'page', boxes: [], quote: null }
			}
		],
		verification: { supported: 2, total: 2, claims: [] },
		model: 'm',
		generation_ms: 2000,
		verify_ms: 800,
		readout: {
			pages_used: 2,
			sentences: 2,
			sentences_verified: 2,
			generation_ms: 2000,
			verify_ms: 800,
			total_ms: 2800
		},
		...over
	};
};

/** A finished step: results, summary and done, as the stream would build it. */
export function step(
	n: number,
	over: {
		req?: Partial<StepRequest>;
		resolved?: string;
		answer?: Answer | null;
		inferred?: { document_id: string; title: string }[];
	} = {}
): TrailStep {
	const req = request(over.req);
	let s = newStep(
		req,
		n,
		{ kettle: 'Kettle Ridge Application' },
		{ kettle: '2026-10-27T18:00:00Z' },
		'2026-10-28T13:55:00Z'
	);
	s = applyEvent(
		s,
		{
			type: 'results',
			query: req.query,
			resolved_query: over.resolved ?? req.query,
			scope: {
				data_source_ids: req.data_source_ids,
				document_ids: req.document_ids,
				inferred_documents: over.inferred ?? []
			},
			results: [
				result(),
				result({ page_number: 431, section: null, snippet: 'determined to be not significant' })
			],
			retrieval_ms: 500,
			reranked: true,
			readout
		},
		req.from
	);
	const a = over.answer === undefined ? answer() : over.answer;
	if (a) s = applyEvent(s, { type: 'summary', answer: a }, req.from);
	return applyEvent(s, { type: 'done', readout: { ...readout, total_ms: 3400 } }, req.from);
}
