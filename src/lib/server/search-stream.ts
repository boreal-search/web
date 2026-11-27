// The pure parts of web's POST /search/stream (routes/(app)/search/stream/+server.ts): checking
// the browser's StepRequest, and relaying the engine's events while recording the step. Kept
// here, apart from SvelteKit, so both are tested with fakes.
import {
	applyEvent,
	MAX_CONTEXT,
	storedStep,
	type EngineEvent,
	type StepRequest,
	type StreamEvent,
	type TrailStep
} from '#lib/trail.js';
import { FAILURE_STATUS, type SearchEventInput } from './analytics.js';
import { classifyEngineError, EngineError } from './engine.js';
import type { ContextStep } from './engine.types';
import { isUuid, type StoredAt } from './trails.js';

type ResultsEvent = Extract<EngineEvent, { type: 'results' }>;

const MAX_TOP_K = 50;
const MAX_QUERY = 2_000;
/** A context step's plan, as JSON text. The engine's largest (3 parts of 2,000 characters, 32 data sources each) is about 21 kB. */
const MAX_PLAN = 32_000;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] =>
	Array.isArray(v) && v.every((s) => typeof s === 'string');
const isStringRecord = (v: unknown): v is Record<string, string> =>
	isRecord(v) && isStrings(Object.values(v));

/**
 * Check a StepRequest from the browser. Optional fields take the engine's defaults; present
 * ones must have the right type. `top_k` is clamped to 1..MAX_TOP_K, an empty `document_ids`
 * means all. Authorization is not checked here.
 */
export function parseStepRequest(body: unknown): Parsed<StepRequest> {
	if (!isRecord(body)) return { ok: false, error: 'Send a JSON object.' };
	const bad = (field: string, what: string) => ({ ok: false as const, error: `${field}: ${what}` });
	const bool = (key: string, fallback: boolean) => {
		const v = body[key];
		return v === undefined ? fallback : typeof v === 'boolean' ? v : null;
	};

	const query = typeof body.query === 'string' ? body.query.trim() : '';
	if (!query) return bad('query', 'enter a query.');
	if (query.length > MAX_QUERY) return bad('query', `at most ${MAX_QUERY} characters.`);

	const { data_source_ids, document_ids, context } = body;
	if (!isStrings(data_source_ids) || data_source_ids.length === 0)
		return bad('data_source_ids', 'select at least one data source.');
	if (document_ids != null && !isStrings(document_ids))
		return bad('document_ids', 'a list of document ids, or null.');
	const document_titles = body.document_titles === undefined ? {} : body.document_titles;
	if (!isStringRecord(document_titles)) return bad('document_titles', 'an object of id → title.');

	const rewrite = bool('rewrite', true);
	if (rewrite === null) return bad('rewrite', 'true or false.');
	const doc_filter = bool('doc_filter', true);
	if (doc_filter === null) return bad('doc_filter', 'true or false.');
	const answer = bool('answer', false);
	if (answer === null) return bad('answer', 'true or false.');
	const rerank = bool('rerank', true);
	if (rerank === null) return bad('rerank', 'true or false.');

	const topK = body.top_k === undefined ? 10 : body.top_k;
	if (typeof topK !== 'number' || !Number.isFinite(topK)) return bad('top_k', 'a number.');

	const from = body.from ?? null;
	if (from !== null && !(typeof from === 'number' && Number.isInteger(from) && from >= 1))
		return bad('from', 'a step number, or null.');
	const trail_id = body.trail_id ?? null;
	if (trail_id !== null && !(typeof trail_id === 'string' && isUuid(trail_id)))
		return bad('trail_id', 'a trail id, or null.');

	const steps = context ?? [];
	if (!Array.isArray(steps) || steps.length > MAX_CONTEXT)
		return bad('context', `at most ${MAX_CONTEXT} earlier steps.`);
	const parsedContext: ContextStep[] = [];
	for (const c of steps) {
		const step = parseContextStep(c);
		if (!step)
			return bad('context', 'each step needs a query and, optionally, its scope and plan.');
		parsedContext.push(step);
	}

	return {
		ok: true,
		value: {
			query,
			data_source_ids,
			document_ids: document_ids && document_ids.length > 0 ? document_ids : null,
			rewrite,
			doc_filter,
			answer,
			rerank,
			top_k: Math.min(Math.max(Math.trunc(topK), 1), MAX_TOP_K),
			from,
			context: parsedContext,
			document_titles,
			trail_id
		}
	};
}

function parseContextStep(c: unknown): ContextStep | null {
	if (!isRecord(c) || typeof c.query !== 'string' || !c.query.trim()) return null;
	if (c.resolved_query != null && typeof c.resolved_query !== 'string') return null;
	const step: ContextStep = { query: c.query };
	if (typeof c.resolved_query === 'string') step.resolved_query = c.resolved_query;
	if (c.scope != null) {
		const s = c.scope;
		if (!isRecord(s) || !isStrings(s.data_source_ids)) return null;
		if (s.document_ids != null && !isStrings(s.document_ids)) return null;
		if (s.inferred_document_ids != null && !isStrings(s.inferred_document_ids)) return null;
		step.scope = {
			data_source_ids: s.data_source_ids,
			...(s.document_ids ? { document_ids: s.document_ids } : {}),
			// The engine keeps ids only within the (access-checked) data sources.
			...(s.inferred_document_ids ? { inferred_document_ids: s.inferred_document_ids } : {})
		};
	}
	if (c.plan != null) {
		// The engine's own plan, echoed back: passed on as is, never read here beyond its ids.
		if (!isRecord(c.plan) || JSON.stringify(c.plan).length > MAX_PLAN) return null;
		step.plan = c.plan;
	}
	return step;
}

/** The data source ids in a context step's plan (`facets[].scope`), however it's shaped. */
function planDataSources(plan: unknown): string[] {
	if (!isRecord(plan) || !Array.isArray(plan.facets)) return [];
	return plan.facets.flatMap((f) => (isRecord(f) && isStrings(f.scope) ? f.scope : []));
}

/** Every data source id a request names, in its scope or its context: all must be allowed. */
export const requestedDataSources = (req: StepRequest) => [
	...new Set([
		...req.data_source_ids,
		...req.context.flatMap((c) => [...(c.scope?.data_source_ids ?? []), ...planDataSources(c.plan)])
	])
];

/** Where finished steps go; null in a context that doesn't keep search history. */
export interface StepStore {
	insert(step: TrailStep): Promise<StoredAt>;
	complete(at: StoredAt, step: TrailStep): Promise<void>;
}

interface DriveOptions {
	events: AsyncIterable<EngineEvent>;
	/** The step before any event (`newStep`). */
	step: TrailStep;
	/** The step the request refines. */
	from: number | null;
	/** Write one event to the browser; may be gone (then it's a no-op). */
	send: (event: StreamEvent) => void;
	store: StepStore | null;
	/** Whether web's own deadline ended the stream (vs. the browser leaving or a failure). */
	timedOut: () => boolean;
	/** Persistence failures are logged, never shown. */
	log?: (message: string, e: unknown) => void;
}

/**
 * Relay the engine's events to the browser as they arrive, building the step with `applyEvent`.
 * When results arrive the step is stored (if `store`), without holding up the relay, and the
 * browser gets `stored`; once the stream ends, the stored step is completed with its summary
 * and final readout. Ends with exactly one of done, error or timeout for the browser: an engine
 * stream that just stops is an error. Never throws; resolves with the final step (and the raw
 * results event, scores included, and where the step was stored, for analytics) once every
 * write has finished.
 */
export async function driveStep(
	opts: DriveOptions
): Promise<{ step: TrailStep; results: ResultsEvent | null; at: StoredAt | null }> {
	const { from, send, store, log = console.error } = opts;
	let step = opts.step;
	let stored: Promise<StoredAt | null> = Promise.resolve(null);
	let ended = false;
	let results: ResultsEvent | null = null;

	const apply = (event: StreamEvent) => {
		step = applyEvent(step, event, from);
	};

	try {
		for await (const event of opts.events) {
			send(event);
			apply(event);
			if (event.type === 'results') results = event;
			if (event.type === 'results' && store) {
				stored = store.insert(storedStep(step)).then(
					(at) => {
						send({ type: 'stored', ...at });
						return at;
					},
					(e: unknown) => {
						log('trail step insert failed', e);
						return null;
					}
				);
			}
			if (event.type === 'done' || event.type === 'error') {
				ended = true;
				break;
			}
		}
		if (!ended) {
			ended = true;
			const event: StreamEvent = {
				type: 'error',
				status: null,
				detail: 'The search engine stopped before finishing.'
			};
			send(event);
			apply(event);
		}
	} catch (e) {
		if (!ended) {
			const event: StreamEvent = opts.timedOut()
				? { type: 'timeout' }
				: {
						type: 'error',
						status: null,
						detail:
							e instanceof Error && e.name === 'AbortError' ? 'The search was stopped.' : String(e)
					};
			send(event);
			apply(event);
		}
	}

	const at = await stored;
	if (at && store) {
		try {
			await store.complete(at, storedStep(step));
		} catch (e) {
			log('trail step update failed', e);
		}
	}
	return { step, results, at };
}

/**
 * The search_events outcome of a finished stream: ok once results arrived (noting a summary
 * that failed), else the failure, classified as for any engine call.
 */
export function streamOutcome(
	step: TrailStep,
	results: ResultsEvent | null
): Pick<SearchEventInput, 'status' | 'response' | 'error'> {
	const e = step.readout.error;
	const why = !e
		? undefined
		: e.kind === 'timeout'
			? 'timeout'
			: `${e.status ?? 'stream'}: ${e.detail}`;
	if (results) return { status: 'ok', response: results, error: why && `summary failed: ${why}` };
	if (!e || e.kind === 'timeout') return { status: 'timeout', error: 'timeout' };
	const failure = classifyEngineError(
		e.status === null ? new Error(e.detail) : new EngineError(e.status, e.detail)
	);
	return { status: FAILURE_STATUS[failure.kind], error: why };
}
