// Product analytics: one search_events row per search, written after the engine responds.
// Never blocks or fails the user's request — a logging failure is logged and dropped.
import type { SupabaseClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import type { EngineFailure } from '#lib/failure.js';
import type { Database, Json, SearchStatus } from '#lib/supabase/types.js';
import type { TrailStep } from '#lib/trail.js';
import type { SearchResponse, SearchResult } from './engine.types';
import type { StoredAt } from './trails.js';

export interface SearchEventInput {
	/** Set by the caller when it needs the row's id (the stream sends it as `recorded`). */
	id?: string;
	/** The current org, or null for a search in the Public context. */
	orgId: string | null;
	userId: string;
	query: string;
	dataSourceIds: string[];
	topK: number;
	rerank: boolean;
	/** The context's `log_queries` switch (`logsQueries` in access.ts). */
	logQueries: boolean;
	status: SearchStatus;
	/** The results (the stream's `results` event, or a whole SearchResponse); absent on failure. */
	response?: Pick<
		SearchResponse,
		'results' | 'retrieval_ms' | 'reranked' | 'engine_version' | 'plan'
	>;
	error?: string;
	/** What the user saw (a streamed step), and where it was stored in their trail, if it was. */
	seen?: { step: TrailStep; at: StoredAt | null };
}

/** search_events.status for each engine failure. */
export const FAILURE_STATUS: Record<EngineFailure['kind'], SearchStatus> = {
	timeout: 'timeout',
	unreachable: 'unreachable',
	unavailable: 'unavailable',
	error: 'engine_error'
};

/** A result without its signed URLs, which expire. */
function keptResult(r: SearchResult) {
	const copy: Partial<SearchResult> = { ...r };
	delete copy.page_image_url;
	delete copy.pdf_url;
	return copy;
}

/**
 * Build the row; `logQueries: false` keeps the length, counts, timings, outcome and engine version
 * but drops the text, the summary, the plan, the results and where the search sits in a trail.
 * Results keep their scores and facets.
 */
export function buildSearchEvent(
	input: SearchEventInput
): Database['public']['Tables']['search_events']['Insert'] {
	const { response, seen, logQueries } = input;
	const text = logQueries ? seen?.step : undefined;
	return {
		...(input.id ? { id: input.id } : {}),
		org_id: input.orgId,
		user_id: input.userId,
		data_source_ids: input.dataSourceIds,
		query: logQueries ? input.query : null,
		query_length: input.query.length,
		top_k: input.topK,
		rerank: input.rerank,
		status: input.status,
		result_count: response ? response.results.length : null,
		top_score: response?.results[0]?.score ?? null,
		retrieval_ms: response?.retrieval_ms ?? null,
		reranked: response?.reranked ?? null,
		error: input.error ?? null,
		trail_id: logQueries ? (seen?.at?.trail_id ?? null) : null,
		step_n: logQueries ? (seen?.at?.n ?? null) : null,
		resolved_query: text?.resolved_query ?? null,
		answer: (text?.answer ?? null) as Json,
		results: logQueries && response ? (response.results.map(keptResult) as Json) : null,
		total_ms: seen?.step.readout.search?.total_ms ?? null,
		engine_version: response?.engine_version ?? null,
		plan: logQueries ? ((response?.plan ?? null) as Json) : null
	};
}

/** Insert the row now. Never throws: false (logged) when it could not be recorded. */
export async function insertSearchEvent(
	supabase: SupabaseClient<Database>,
	input: SearchEventInput
): Promise<boolean> {
	try {
		const { error } = await supabase.from('search_events').insert(buildSearchEvent(input));
		if (error) throw error;
		return true;
	} catch (e) {
		console.error('search_events insert failed', e);
		return false;
	}
}

/**
 * Record a search without holding up the response. On Vercel the insert goes to `waitUntil` so it runs after the response is
 * sent; elsewhere (dev, `vite preview`, tests) it is awaited, because `waitUntil` is a no-op
 * off-Vercel and the insert would be left dangling. `VERCEL=1` is a Vercel system env var.
 */
export async function recordSearchEvent(
	supabase: SupabaseClient<Database>,
	input: SearchEventInput
): Promise<void> {
	const work = insertSearchEvent(supabase, input);

	if (process.env.VERCEL) waitUntil(work);
	else await work;
}
