// Product analytics: one search_events row per search, written after the engine responds.
// Never blocks or fails the user's request — a logging failure is logged and dropped.
import type { SupabaseClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import type { Database, SearchStatus } from '#lib/supabase/types.js';
import type { SearchResponse } from './engine.types';

export interface SearchEventInput {
	orgId: string;
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
			const { data: org, error: orgErr } = await supabase
				.from('orgs')
				.select('log_queries')
				.eq('id', input.orgId)
				.single();
			if (orgErr) throw orgErr;

			const { error } = await supabase
				.from('search_events')
				.insert(buildSearchEvent(input, org.log_queries));
			if (error) throw error;
		} catch (e) {
			console.error('search_events insert failed', e);
		}
	})();

	if (process.env.VERCEL) waitUntil(work);
	else await work;
}
