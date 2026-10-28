// Product analytics: one search_events row per search, written after the engine responds.
// Never blocks or fails the user's request — a logging failure is logged and dropped.
import type { SupabaseClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import type { Database, SearchStatus } from '#lib/supabase/types.js';
import type { SearchResponse } from './engine.types';

export interface SearchEventInput {
	/** The current org, or null for a search in the Public context. */
	orgId: string | null;
	userId: string;
	query: string;
	dataSourceIds: string[];
	topK: number;
	rerank: boolean;
	status: SearchStatus;
	response?: SearchResponse;
	error?: string;
}

/** Build the row; `logQueries=false` keeps the length but drops the text. */
export function buildSearchEvent(
	input: SearchEventInput,
	logQueries: boolean
): Database['public']['Tables']['search_events']['Insert'] {
	const { response } = input;
	return {
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
		error: input.error ?? null
	};
}

/** The org's `log_queries` switch. Public searches have no org and always keep the text. */
async function logsQueries(supabase: SupabaseClient<Database>, orgId: string | null) {
	if (orgId === null) return true;
	const { data, error } = await supabase
		.from('orgs')
		.select('log_queries')
		.eq('id', orgId)
		.single();
	if (error) throw error;
	return data.log_queries;
}

/**
 * Record a search. On Vercel the insert goes to `waitUntil` so it runs after the response is
 * sent; elsewhere (dev, `vite preview`, tests) it is awaited, because `waitUntil` is a no-op
 * off-Vercel and the insert would be left dangling. `VERCEL=1` is a Vercel system env var.
 */
export async function recordSearchEvent(
	supabase: SupabaseClient<Database>,
	input: SearchEventInput
): Promise<void> {
	const work = (async () => {
		try {
			const { error } = await supabase
				.from('search_events')
				.insert(buildSearchEvent(input, await logsQueries(supabase, input.orgId)));
			if (error) throw error;
		} catch (e) {
			console.error('search_events insert failed', e);
		}
	})();

	if (process.env.VERCEL) waitUntil(work);
	else await work;
}
