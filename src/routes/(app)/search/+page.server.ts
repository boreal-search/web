import { fail } from '@sveltejs/kit';
import { findForbiddenDataSources, getAccess, resolveSearchOrg } from '#lib/server/access.js';
import { recordSearchEvent } from '#lib/server/analytics.js';
import { requireUser } from '#lib/server/auth.js';
import {
	answerNotice,
	engine,
	engineErrorMessage,
	engineFailureMessage,
	FAILURE_HTTP_STATUS,
	type EngineFailure,
	type SearchResponse
} from '#lib/server/engine.js';
import type { SearchStatus } from '#lib/supabase/types.js';
import type { Actions, PageServerLoad } from './$types';

const MAX_TOP_K = 50;

export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { accessibleDataSourceIds } = await parent();
	if (accessibleDataSourceIds.length === 0) return { dataSources: [], engineError: null };
	const allowed = new Set(accessibleDataSourceIds);

	try {
		const all = await engine(fetch).listDataSources();
		return { dataSources: all.filter((ds) => allowed.has(ds.id)), engineError: null };
	} catch (e) {
		return { dataSources: [], engineError: engineErrorMessage(e) };
	}
};

/** search_events.status for each engine failure. */
const FAILURE_STATUS: Record<EngineFailure['kind'], SearchStatus> = {
	timeout: 'timeout',
	unreachable: 'unreachable',
	unavailable: 'unavailable',
	error: 'engine_error'
};

export const actions: Actions = {
	default: async ({ request, locals, fetch }) => {
		const user = requireUser();
		const form = await request.formData();
		const query = String(form.get('query') ?? '').trim();
		const requested = form.getAll('data_source_ids').map(String);
		const topK = Math.min(Math.max(Number(form.get('top_k') ?? 10) || 10, 1), MAX_TOP_K);
		const rerank = form.get('rerank') !== 'off';
		const answer = form.get('answer') === 'on';

		if (!query) return fail(400, { query, requested, answer, error: 'Enter a query.' });
		if (requested.length === 0) {
			return fail(400, { query, requested, answer, error: 'Select at least one data source.' });
		}

		// Re-check access on every search; never trust the ids posted by the form.
		const access = await getAccess(locals.supabase, user.id);
		const forbidden = findForbiddenDataSources(requested, access.dataSourceIds);
		const orgId = resolveSearchOrg(requested, access.grants);

		// Analytics: fire-and-forget on Vercel (waitUntil); awaited in dev/tests. See analytics.ts.
		// Searches without an org (a future public tier) are not recorded.
		const record = (status: SearchStatus, extra: { response?: SearchResponse; error?: string }) => {
			if (!orgId) return Promise.resolve();
			return recordSearchEvent(locals.supabase, {
				orgId,
				userId: user.id,
				query,
				dataSourceIds: requested,
				topK,
				rerank,
				status,
				...extra
			});
		};

		if (forbidden.length > 0) {
			await record('forbidden', { error: `forbidden: ${forbidden.join(',')}` });
			return fail(403, {
				query,
				requested,
				answer,
				error: `You don't have access to: ${forbidden.join(', ')}. Reload the page to see what you can search.`
			});
		}

		const outcome = await engine(fetch).search({
			query,
			data_source_ids: requested,
			top_k: topK,
			rerank,
			answer
		});

		if (outcome.kind === 'ok' || outcome.kind === 'no_results') {
			const a = outcome.answer;
			await record('ok', {
				response: outcome.response,
				error:
					a.kind === 'failed'
						? `answer failed: ${a.failure.kind}`
						: a.kind === 'disabled'
							? 'answer disabled'
							: undefined
			});
			return { query, requested, answer, outcome, answerNotice: answerNotice(a) };
		}

		const detail = 'detail' in outcome ? outcome.detail : undefined;
		await record(FAILURE_STATUS[outcome.kind], {
			error: detail ? `${outcome.kind}: ${detail}` : outcome.kind
		});
		return fail(FAILURE_HTTP_STATUS[outcome.kind], {
			query,
			requested,
			answer,
			error: engineFailureMessage(outcome)
		});
	}
};
