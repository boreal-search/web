import { describe, expect, it } from 'vitest';
import {
	applyEvent,
	followUp,
	isNarrowed,
	newStep,
	refine,
	scopeLabel,
	stepNumber,
	storedStep,
	widen
} from './trail.js';
import { readout, request, result, step } from './trail.fixture.js';

const plan = { document_id: 'plan', title: 'Offsetting Plan' };

describe('stepNumber', () => {
	it('pads to two digits', () => {
		expect([1, 9, 12].map(stepNumber)).toEqual(['01', '09', '12']);
	});
});

describe('refine', () => {
	it('sends earlier steps as context, with the documents each was narrowed to by name', () => {
		const steps = [
			step(1),
			step(2, {
				req: { query: 'Just the offsetting plan. How is the 2.4 ha made up?', from: 1 },
				resolved: 'How is the 2.4 ha of Chinook habitat offsetting made up?',
				inferred: [plan]
			}),
			step(3)
		];
		const r = refine(steps, 2);
		// The named document is not sent as document_ids (that would pin the follow-up to it);
		// the engine carries it from context unless the follow-up names another or asks for all.
		expect(r).toEqual({
			data_source_ids: ['kettle'],
			document_ids: null,
			document_titles: {},
			from: 2,
			context: [
				{
					query: 'What residual effects on Chinook habitat?',
					resolved_query: 'What residual effects on Chinook habitat?',
					scope: { data_source_ids: ['kettle'], inferred_document_ids: [] }
				},
				{
					query: 'Just the offsetting plan. How is the 2.4 ha made up?',
					resolved_query: 'How is the 2.4 ha of Chinook habitat offsetting made up?',
					scope: { data_source_ids: ['kettle'], inferred_document_ids: ['plan'] }
				}
			]
		});
		// Context is queries and scopes only: never summaries or results.
		expect(JSON.stringify(r.context)).not.toMatch(/Rated not significant|magnitude/);
	});

	it("sends each step's plan back as is, and none for a step without one (engine 1.x)", () => {
		const searchPlan = {
			intent: 'Limitation periods under the IAA and the Fisheries Act',
			facets: [
				{ q: 'limitation period under the IAA', scope: [], gated: false, retried: false },
				{ q: '… under the Fisheries Act', scope: ['kettle'], gated: false, retried: false }
			]
		};
		const steps = [step(1), step(2, { req: { from: 1 }, plan: searchPlan })];
		expect(steps[1]?.plan).toEqual(searchPlan);
		const [first, second] = refine(steps, 2).context;
		expect(first).not.toHaveProperty('plan');
		expect(second?.plan).toBe(searchPlan);
	});

	it('prefers explicit document ids, with their titles', () => {
		const s = step(1, {
			req: { document_ids: ['vol3'], document_titles: { vol3: 'Vol 3' } },
			inferred: [plan]
		});
		expect(refine([s], 1)).toMatchObject({
			document_ids: ['vol3'],
			document_titles: { vol3: 'Vol 3' },
			context: [
				{
					scope: {
						data_source_ids: ['kettle'],
						document_ids: ['vol3'],
						inferred_document_ids: ['plan']
					}
				}
			]
		});
	});

	it('sends at most the last five steps up to k, oldest first', () => {
		const steps = [7, 1, 3, 2, 6, 5, 4].map((n) => step(n, { req: { query: `q${n}` } }));
		expect(refine(steps, 6).context.map((c) => c.query)).toEqual(['q2', 'q3', 'q4', 'q5', 'q6']);
		expect(refine(steps, 1)).toMatchObject({ document_ids: null, context: [{ query: 'q1' }] });
	});

	it('refuses a step that is not in the trail', () => {
		expect(() => refine([step(1)], 2)).toThrow();
	});
});

describe('widen', () => {
	it('re-runs exactly what was searched over all documents, as a new step', () => {
		const s = step(2, {
			req: { query: 'Just the plan?', from: 1 },
			resolved: 'offsetting plan',
			inferred: [plan]
		});
		expect(widen(s)).toEqual({
			query: 'offsetting plan',
			data_source_ids: ['kettle'],
			document_ids: null,
			document_titles: {},
			rewrite: false,
			doc_filter: false,
			from: 2,
			context: []
		});
	});
});

describe('scope', () => {
	it('is narrowed by documents, explicit or named in the query', () => {
		expect(isNarrowed(step(1))).toBe(false);
		expect(isNarrowed(step(1, { inferred: [plan] }))).toBe(true);
		expect(isNarrowed(step(1, { req: { document_ids: ['vol3'] } }))).toBe(true);
	});

	it('is narrowed when fewer data sources were searched than the user can search', () => {
		expect(isNarrowed(step(1), ['kettle'])).toBe(false);
		expect(isNarrowed(step(1), ['kettle', 'sara'])).toBe(true);
	});

	it('labels documents when narrowed to them, else data sources', () => {
		expect(scopeLabel(step(1))).toBe('Kettle Ridge Application');
		expect(scopeLabel(step(1, { inferred: [plan] }))).toBe('Offsetting Plan');
		expect(scopeLabel(step(1, { req: { document_ids: ['vol3'] } }))).toBe('vol3');
	});
});

describe('applyEvent', () => {
	it('keeps results in the order given, whatever their scores, and missing 2.x fields', () => {
		const s0 = step(1);
		const event = {
			type: 'results' as const,
			query: s0.query,
			resolved_query: s0.query,
			scope: { data_source_ids: ['kettle'], document_ids: null, inferred_documents: [] },
			results: [
				result({ page_number: 7, score: 0.2, facets: [1] }),
				result({ page_number: 3, score: 0.9, facets: [] }),
				result({ page_number: 5, score: 0.5 })
			],
			retrieval_ms: 1,
			reranked: true,
			readout
		};
		const s = applyEvent(newStep(request(), 1, {}, {}), event, null);
		expect(s.results.map((r) => r.page_number)).toEqual([7, 3, 5]);
		expect(s.plan).toBeNull();
	});
});

describe('storedStep', () => {
	it('keeps locators and drops signed URLs', () => {
		const s = step(1);
		expect(s.results[0]?.page_image_url).toMatch(/sig=/);
		const json = JSON.stringify(storedStep(s));
		expect(json).not.toMatch(/sig=|page_image_url|pdf_url|score/);
		expect(storedStep(s).results[0]).toEqual({
			document_id: 'vol3',
			document_title: 'Vol 3',
			data_source_id: 'kettle',
			page_number: 412,
			section: '§12.6',
			snippet: 'predicted to be low in magnitude'
		});
	});
});

describe('followUp', () => {
	it('is null for an empty trail', () => {
		expect(followUp([], ['kettle'])).toBeNull();
	});

	it('continues from the latest step, whatever order the steps come in', () => {
		const steps = [
			step(2, { req: { query: 'q2', from: 1 } }),
			step(1),
			step(3, { req: { query: 'q3' } })
		];
		const r = followUp(steps, ['kettle']);
		expect(r).toEqual(refine(steps, 3));
		expect(r?.from).toBe(3);
	});

	it('keeps chosen documents only while the data sources are unchanged', () => {
		const s = step(1, { req: { document_ids: ['vol3'], document_titles: { vol3: 'Vol 3' } } });
		expect(followUp([s], ['kettle'])).toMatchObject({ document_ids: ['vol3'] });
		expect(followUp([s], ['kettle', 'other'])).toMatchObject({
			data_source_ids: ['kettle', 'other'],
			document_ids: null,
			document_titles: {},
			from: 1
		});
	});
});
