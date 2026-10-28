// The search trail (infra/docs/handovers/2026-10-28-search-trail.md): each search is a step
// with its own scope, results and checked summary, kept as a record. Pure and shared: the
// server builds the stored snapshot from the engine's stream with `applyEvent`, and the
// browser builds the step it shows from the same events, so both agree on what a step is.
import type {
	Answer,
	AnswerReadout,
	ContextStep,
	Scope,
	SearchReadout,
	SearchResponse,
	SearchResult
} from '#lib/server/engine.types.js';

/** At most this many previous steps go to the engine as `context` (6+ is a 422). */
export const MAX_CONTEXT = 5;

/** A result as stored: locators only. Signed URLs expire and are never stored. */
export type StepResult = Omit<SearchResult, 'page_image_url' | 'pdf_url' | 'score'> & {
	/** The engine's signed render URL, live steps only; never stored (see `storedStep`). */
	page_image_url?: string;
};

/** The engine's scope, plus the names shown in the scope chip, as they were at search time. */
export interface StepScope extends Scope {
	/** data_source_id → name. */
	data_source_names: Record<string, string>;
	/** document_id → title, for `document_ids` (inferred documents carry their own titles). */
	document_titles: Record<string, string>;
}

/** Why a step has no summary, or no results. */
export type StepError =
	/** The whole stream ran out of time (180 s with a summary, 60 s without). */
	| { kind: 'timeout' }
	/** The engine's `error` event, or a failure reaching it. */
	| { kind: 'engine'; status: number | null; detail: string };

export interface StepReadout {
	/** The engine's search readout; `total_ms` is the whole search once `done` arrives. */
	search: SearchReadout | null;
	answer: AnswerReadout | null;
	/** data_source_id → its index date (DataSource.indexed_at) when searched. */
	indexed_at: Record<string, string | null>;
	error: StepError | null;
	/** The stream finished (`done`, or an error/timeout after which nothing more comes). */
	finished: boolean;
}

/** One search in a trail: what the user typed, what was searched, and what they saw. */
export interface TrailStep {
	/** 1, 2, 3; shown as 01, 02, 03. */
	n: number;
	query: string;
	/** As searched; equals `query` without context or with `rewrite: false`. */
	resolved_query: string;
	rewrite: boolean;
	scope: StepScope;
	/** The step this one refined, when the rewrite used the trail; null = fresh. */
	builds_on: number | null;
	results: StepResult[];
	answer: Answer | null;
	/** Whether a summary was asked for. */
	wants_answer: boolean;
	readout: StepReadout;
	created_at: string;
}

/** What starts a step, before the engine has answered. */
export interface StepRequest {
	query: string;
	data_source_ids: string[];
	/** Narrow within the data sources (the scope chip carried from the step refined). */
	document_ids: string[] | null;
	rewrite: boolean;
	/** false: "Search all N documents": don't narrow to documents named in the query. */
	doc_filter: boolean;
	answer: boolean;
	top_k: number;
	rerank: boolean;
	/** The step this refines (its n), or null for a new trail. */
	from: number | null;
	/** Earlier steps, oldest first, newest last; at most MAX_CONTEXT. */
	context: ContextStep[];
	/** document_id → title for `document_ids`, for the scope chip. */
	document_titles: Record<string, string>;
	/** The stored trail to add to; null = a new trail. */
	trail_id: string | null;
}

/** Engine `/search/stream` events (infra/docs/architecture.md). */
export type EngineEvent =
	| { type: 'stage'; stage: 'rewriting' }
	| { type: 'stage'; stage: 'searching' | 'reading'; pages: number }
	| { type: 'stage'; stage: 'checking'; sentences: number }
	| ({ type: 'results' } & Omit<SearchResponse, 'answer'>)
	| { type: 'summary'; answer: Answer }
	| { type: 'done'; readout: SearchReadout }
	| { type: 'error'; status: number | null; detail: string };

/**
 * What web's `/search/stream` sends the browser: the engine's events, unchanged, plus
 * `stored` once the step is saved (never when the org doesn't keep search history), and
 * `timeout` (web's own deadline) in place of an engine error.
 */
export type StreamEvent =
	EngineEvent | { type: 'stored'; trail_id: string; n: number } | { type: 'timeout' };

/** A new step, before any event. `indexed_at`/names come from the engine's data source list. */
export function newStep(
	req: StepRequest,
	n: number,
	names: Record<string, string>,
	indexedAt: Record<string, string | null>,
	now = new Date().toISOString()
): TrailStep {
	const pick = <T>(m: Record<string, T>, ids: readonly string[]) =>
		Object.fromEntries(ids.filter((id) => id in m).map((id) => [id, m[id]]));
	return {
		n,
		query: req.query,
		resolved_query: req.query,
		rewrite: req.rewrite,
		scope: {
			data_source_ids: req.data_source_ids,
			document_ids: req.document_ids,
			inferred_documents: [],
			data_source_names: pick(names, req.data_source_ids),
			document_titles: pick(req.document_titles, req.document_ids ?? [])
		},
		builds_on: null,
		results: [],
		answer: null,
		wants_answer: req.answer,
		readout: {
			search: null,
			answer: null,
			indexed_at: pick(indexedAt, req.data_source_ids),
			error: null,
			finished: false
		},
		created_at: now
	};
}

/**
 * The step after one event. `from`: the step the request refined. Stage events don't change a
 * step (the waiting bar reads them directly). Pure: returns a new step.
 */
export function applyEvent(step: TrailStep, event: StreamEvent, from: number | null): TrailStep {
	switch (event.type) {
		case 'results': {
			const { scope } = event;
			return {
				...step,
				resolved_query: event.resolved_query,
				builds_on: from !== null && event.resolved_query !== step.query ? from : null,
				scope: { ...step.scope, ...scope },
				results: event.results.map(stepResult),
				readout: { ...step.readout, search: event.readout }
			};
		}
		case 'summary':
			return {
				...step,
				answer: event.answer,
				readout: { ...step.readout, answer: event.answer.readout }
			};
		case 'done':
			return {
				...step,
				readout: { ...step.readout, search: event.readout, finished: true }
			};
		case 'error':
			return {
				...step,
				readout: {
					...step.readout,
					error: { kind: 'engine', status: event.status, detail: event.detail },
					finished: true
				}
			};
		case 'timeout':
			return {
				...step,
				readout: { ...step.readout, error: { kind: 'timeout' }, finished: true }
			};
		case 'stored':
			return { ...step, n: event.n };
		case 'stage':
			return step;
	}
}

/** Keep a result's locators; the signed page URL stays for live display only. */
const stepResult = ({
	document_id,
	document_title,
	data_source_id,
	page_number,
	section,
	snippet,
	page_image_url
}: SearchResult): StepResult => ({
	document_id,
	document_title,
	data_source_id,
	page_number,
	section,
	snippet,
	page_image_url
});

/** The step as stored: no signed URLs anywhere. */
export const storedStep = (step: TrailStep): TrailStep => ({
	...step,
	results: step.results.map((r) => {
		const copy = { ...r };
		delete copy.page_image_url;
		return copy;
	})
});

/** "01", "02", … "12". */
export const stepNumber = (n: number) => String(n).padStart(2, '0');

/** What the user sets on every step (the picker's options and the trail); the rest comes from the trail. */
type StepSettings = 'answer' | 'top_k' | 'rerank' | 'trail_id';

/** The documents a step was narrowed to: explicit `document_ids`, else those its query named; none = all. Widen applies when there are some. */
export function stepDocuments(step: TrailStep): { ids: string[]; titles: Record<string, string> } {
	const { document_ids, document_titles, inferred_documents } = step.scope;
	if (document_ids && document_ids.length > 0) {
		const titles = Object.fromEntries(document_ids.map((id) => [id, document_titles[id] ?? id]));
		return { ids: document_ids, titles };
	}
	return {
		ids: inferred_documents.map((d) => d.document_id),
		titles: Object.fromEntries(inferred_documents.map((d) => [d.document_id, d.title]))
	};
}

/**
 * Scope and context for refining step `k` (the search-trail handover, "Building context and
 * scope"): k's data sources and documents (explicit, else the ones its query named), and the
 * last MAX_CONTEXT steps up to k, oldest first, as queries and scopes only, never summaries or
 * results. The caller adds the query, `rewrite` ("Search exactly as typed") and its settings.
 */
export function refine(
	steps: readonly TrailStep[],
	k: number
): Omit<StepRequest, StepSettings | 'query' | 'rewrite' | 'doc_filter'> {
	const upTo = [...steps].filter((s) => s.n <= k).sort((a, b) => a.n - b.n);
	const step = upTo.at(-1);
	if (!step || step.n !== k) throw new Error(`no step ${k} in the trail`);
	const docs = stepDocuments(step);
	return {
		data_source_ids: step.scope.data_source_ids,
		document_ids: docs.ids.length > 0 ? docs.ids : null,
		document_titles: docs.titles,
		from: k,
		context: upTo.slice(-MAX_CONTEXT).map((s) => ({
			query: s.query,
			resolved_query: s.resolved_query,
			scope: {
				data_source_ids: s.scope.data_source_ids,
				...(s.scope.document_ids ? { document_ids: s.scope.document_ids } : {})
			}
		}))
	};
}

/**
 * "Search all N documents" on a narrowed step: what it searched (`resolved_query`, exactly as
 * searched) as a new step over its whole data sources, without narrowing to documents named in
 * the query. The not-found it widens stays in the trail.
 */
export function widen(step: TrailStep): Omit<StepRequest, StepSettings> {
	return {
		query: step.resolved_query,
		data_source_ids: step.scope.data_source_ids,
		document_ids: null,
		document_titles: {},
		rewrite: false,
		doc_filter: false,
		from: step.n,
		context: []
	};
}

/**
 * The step searched less than everything: narrowed to documents, or (given `all`, the ids the
 * user can search) to fewer data sources. Show the scope chip, and widen when it's documents.
 */
export function isNarrowed(step: TrailStep, all: readonly string[] = []): boolean {
	if (stepDocuments(step).ids.length > 0) return true;
	const searched = new Set(step.scope.data_source_ids);
	return all.some((id) => !searched.has(id));
}

/** The scope chip's text: the document titles when narrowed to documents, else data source names. */
export function scopeLabel(step: TrailStep): string {
	const docs = stepDocuments(step);
	if (docs.ids.length > 0) return docs.ids.map((id) => docs.titles[id]).join(', ');
	const { data_source_ids, data_source_names } = step.scope;
	return data_source_ids.map((id) => data_source_names[id] ?? id).join(', ');
}
