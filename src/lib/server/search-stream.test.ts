import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	ENGINE_URL: 'http://engine.test',
	ENGINE_SERVICE_TOKEN: 'test-token'
}));

const { driveStep, parseStepRequest, requestedDataSources, streamOutcome } =
	await import('./search-stream.js');
import { newStep, type EngineEvent, type StreamEvent, type TrailStep } from '#lib/trail.js';
import { answer, readout, request, result } from '#lib/trail.fixture.js';
import type { StepStore } from './search-stream.js';
import type { StoredAt } from './trails.js';

const TRAIL = '4f1c2a3b-0d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('parseStepRequest', () => {
	const valid = { query: '  noise limits ', data_source_ids: ['a'] };

	it('fills the defaults and trims the query', () => {
		expect(parseStepRequest(valid)).toEqual({
			ok: true,
			value: {
				query: 'noise limits',
				data_source_ids: ['a'],
				document_ids: null,
				rewrite: true,
				doc_filter: true,
				answer: false,
				rerank: true,
				top_k: 10,
				from: null,
				context: [],
				document_titles: {},
				trail_id: null
			}
		});
	});

	it('clamps top_k and treats empty document_ids as all', () => {
		const p = (top_k: number) => parseStepRequest({ ...valid, top_k, document_ids: [] });
		expect(p(500)).toMatchObject({ ok: true, value: { top_k: 50, document_ids: null } });
		expect(p(0)).toMatchObject({ ok: true, value: { top_k: 1 } });
	});

	it('keeps a refinement: context, scope, step and trail', () => {
		const out = parseStepRequest({
			...valid,
			document_ids: ['d'],
			document_titles: { d: 'Plan' },
			from: 2,
			trail_id: TRAIL,
			rewrite: false,
			context: [
				{
					query: 'q1',
					resolved_query: null,
					scope: { data_source_ids: ['a'], inferred_document_ids: ['d1'] }
				}
			]
		});
		expect(out).toMatchObject({
			ok: true,
			value: {
				document_ids: ['d'],
				document_titles: { d: 'Plan' },
				from: 2,
				trail_id: TRAIL,
				rewrite: false,
				context: [{ query: 'q1', scope: { data_source_ids: ['a'], inferred_document_ids: ['d1'] } }]
			}
		});
	});

	it.each([
		['not an object', []],
		['no query', { ...valid, query: ' ' }],
		['no data sources', { ...valid, data_source_ids: [] }],
		['ids not strings', { ...valid, data_source_ids: [1] }],
		['a flag not boolean', { ...valid, answer: 'on' }],
		['top_k not a number', { ...valid, top_k: '10' }],
		['bad step', { ...valid, from: 0 }],
		['bad trail id', { ...valid, trail_id: 'x' }],
		['too much context', { ...valid, context: Array(6).fill({ query: 'q' }) }],
		['context without a query', { ...valid, context: [{ resolved_query: 'q' }] }],
		[
			'context inferred ids not strings',
			{
				...valid,
				context: [{ query: 'q', scope: { data_source_ids: ['a'], inferred_document_ids: [1] } }]
			}
		],
		[
			'context scope ids not strings',
			{ ...valid, context: [{ query: 'q', scope: { data_source_ids: [1] } }] }
		]
	])('refuses %s', (_, body) => {
		expect(parseStepRequest(body).ok).toBe(false);
	});

	it('names every data source in the scope and the context, once', () => {
		const req = request({
			data_source_ids: ['a'],
			context: [{ query: 'q', scope: { data_source_ids: ['a', 'secret'] } }, { query: 'r' }]
		});
		expect(requestedDataSources(req)).toEqual(['a', 'secret']);
	});
});

const results: EngineEvent = {
	type: 'results',
	query: 'q',
	resolved_query: 'q standalone',
	scope: { data_source_ids: ['kettle'], document_ids: null, inferred_documents: [] },
	results: [result()],
	retrieval_ms: 500,
	reranked: true,
	readout
};
const summary: EngineEvent = { type: 'summary', answer: answer() };
const done: EngineEvent = { type: 'done', readout: { ...readout, total_ms: 3400 } };

async function* feed(events: EngineEvent[], fail?: Error) {
	for (const e of events) yield e;
	if (fail) throw fail;
}

function fakeStore(opts: { insert?: () => Promise<StoredAt> } = {}) {
	const inserted: TrailStep[] = [];
	const completed: { at: StoredAt; step: TrailStep }[] = [];
	const store: StepStore = {
		insert: async (step) => {
			inserted.push(step);
			return opts.insert ? opts.insert() : { trail_id: TRAIL, n: 3 };
		},
		complete: async (at, step) => {
			completed.push({ at, step });
		}
	};
	return { store, inserted, completed };
}

async function drive(
	events: AsyncIterable<EngineEvent>,
	store: StepStore | null,
	timedOut = false
) {
	const sent: StreamEvent[] = [];
	const log = vi.fn();
	const out = await driveStep({
		events,
		step: newStep(request({ query: 'q', from: 2 }), 0, { kettle: 'Kettle' }, {}),
		from: 2,
		send: (e) => sent.push(e),
		store,
		timedOut: () => timedOut,
		log
	});
	return { ...out, sent: sent.map((e) => e.type), events: sent, log };
}

describe('driveStep', () => {
	it('relays every event, stores the step at results and completes it at the end', async () => {
		const { store, inserted, completed } = fakeStore();
		const stage: EngineEvent = { type: 'stage', stage: 'searching', pages: 6214 };
		const out = await drive(feed([stage, results, summary, done]), store);

		expect(out.sent).toEqual(['stage', 'results', 'stored', 'summary', 'done']);
		expect(out.events).toContainEqual({ type: 'stored', trail_id: TRAIL, n: 3 });
		// Inserted with results only, no signed URLs; completed once with summary and readout.
		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({
			resolved_query: 'q standalone',
			builds_on: 2,
			answer: null
		});
		expect(JSON.stringify(inserted)).not.toMatch(/sig=/);
		expect(completed).toHaveLength(1);
		expect(completed[0]?.at).toEqual({ trail_id: TRAIL, n: 3 });
		expect(completed[0]?.step).toMatchObject({
			answer: { abstained: false },
			readout: { finished: true, search: { total_ms: 3400 }, answer: { sentences: 2 } }
		});
		expect(out.results).toBe(results);
	});

	it('stores nothing and sends no stored event where history is off', async () => {
		const out = await drive(feed([results, done]), null);
		expect(out.sent).toEqual(['results', 'done']);
		expect(out.step.readout.finished).toBe(true);
	});

	it('keeps streaming when storing fails, and logs it', async () => {
		const { store, completed } = fakeStore({ insert: () => Promise.reject(new Error('RLS')) });
		const out = await drive(feed([results, summary, done]), store);
		expect(out.sent).toEqual(['results', 'summary', 'done']);
		expect(completed).toEqual([]);
		expect(out.log).toHaveBeenCalledWith('trail step insert failed', expect.any(Error));
	});

	it("treats a stream that stops without done or error as the engine's error", async () => {
		const { store, completed } = fakeStore();
		const out = await drive(feed([results]), store);
		expect(out.sent).toEqual(['results', 'stored', 'error']);
		expect(completed[0]?.step.readout).toMatchObject({
			finished: true,
			error: { kind: 'engine', status: null }
		});
	});

	it('ends with timeout when the deadline passes, keeping the results', async () => {
		const { store, completed } = fakeStore();
		const abort = new DOMException('timed out', 'TimeoutError');
		const out = await drive(feed([results], abort), store, true);
		expect(out.sent).toEqual(['results', 'stored', 'timeout']);
		expect(completed[0]?.step).toMatchObject({
			results: [{ page_number: 412 }],
			readout: { error: { kind: 'timeout' }, finished: true }
		});
	});

	it("passes the engine's error through and stops", async () => {
		const error: EngineEvent = { type: 'error', status: 503, detail: 'Ollama down' };
		const out = await drive(feed([error, done]), fakeStore().store);
		expect(out.sent).toEqual(['error']);
		expect(out.step.readout.error).toEqual({ kind: 'engine', status: 503, detail: 'Ollama down' });
	});
});

describe('streamOutcome', () => {
	const base = newStep(request(), 0, {}, {});
	const withError = (error: TrailStep['readout']['error']): TrailStep => ({
		...base,
		readout: { ...base.readout, error }
	});
	const res = results as Extract<EngineEvent, { type: 'results' }>;

	it('is ok once results arrived, noting a failed summary', () => {
		expect(streamOutcome(base, res)).toEqual({ status: 'ok', response: res, error: undefined });
		expect(streamOutcome(withError({ kind: 'timeout' }), res)).toMatchObject({
			status: 'ok',
			error: 'summary failed: timeout'
		});
	});

	it('classifies a failure before results like any engine call', () => {
		const engine = (status: number | null) =>
			streamOutcome(withError({ kind: 'engine', status, detail: 'x' }), null).status;
		expect(engine(503)).toBe('unavailable');
		expect(engine(530)).toBe('unreachable');
		expect(engine(500)).toBe('engine_error');
		expect(engine(null)).toBe('engine_error');
		expect(streamOutcome(withError({ kind: 'timeout' }), null).status).toBe('timeout');
	});
});
