import { fail } from '@sveltejs/kit';
import {
	CONTEXT_COOKIE,
	findForbiddenDataSources,
	getAccess,
	withDataSources
} from '#lib/server/access.js';
import { recordSearchEvent } from '#lib/server/analytics.js';
import { requireUser } from '#lib/server/auth.js';
import type { EngineFailure } from '#lib/failure.js';
import {
	answerNotice,
	classifyEngineError,
	engine,
	FAILURE_HTTP_STATUS,
	type SearchResponse
} from '#lib/server/engine.js';
import { canSign } from '#lib/server/files.js';
import type { SearchStatus } from '#lib/supabase/types.js';
import type { Actions, PageServerLoad } from './$types';

const MAX_TOP_K = 50;

interface PickerGroup {
	label: string;
	dataSources: { id: string; name: string; pages: number | null }[];
}

/**
 * Picker groups ("<Org name>", "Public"). If the engine listing fails, ids stand in for names.
 * `permanentLinks`: page images go through `/pages/…` (web signs); else the engine's URLs.
 */
export const load: PageServerLoad = async ({
	parent,
	fetch
}): Promise<{
	groups: PickerGroup[];
	engineFailure: EngineFailure | null;
	permanentLinks: boolean;
}> => {
	const { access } = await parent();
	const permanentLinks = canSign();
	try {
		const list = access.dataSourceIds.length > 0 ? await engine(fetch).listDataSources() : [];
		const groups = withDataSources(access.groups, list).map((g) => ({
			label: g.label,
			dataSources: g.dataSources.map((ds) => ({ id: ds.id, name: ds.name, pages: ds.page_count }))
		}));
		return { groups, engineFailure: null, permanentLinks };
	} catch (e) {
		const groups = access.groups.map((g) => ({
			label: g.label,
			dataSources: g.ids.map((id) => ({ id, name: id, pages: null }))
		}));
		return { groups, engineFailure: classifyEngineError(e), permanentLinks };
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
	default: async ({ request, locals, cookies, fetch }) => {
		const user = requireUser();
		const form = await request.formData();
		const query = String(form.get('query') ?? '').trim();
		const requested = form.getAll('data_source_ids').map(String);
		const topK = Math.min(Math.max(Number(form.get('top_k') ?? 10) || 10, 1), MAX_TOP_K);
		const rerank = form.get('rerank') === 'on';
		const answer = form.get('answer') === 'on';

		if (!query)
			return fail(400, { query, requested, answer, topK, rerank, error: 'Enter a query.' });
		if (requested.length === 0) {
			return fail(400, {
				query,
				requested,
				answer,
				topK,
				rerank,
				error: 'Select at least one data source.'
			});
		}

		// Re-check access on every search; never trust the cookie or the ids posted by the form.
		const { context, dataSourceIds } = await getAccess(
			locals.supabase,
			user.id,
			cookies.get(CONTEXT_COOKIE)
		);
		const forbidden = findForbiddenDataSources(requested, dataSourceIds);

		// Attributed to the current org (null in Public). Fire-and-forget on Vercel (waitUntil);
		// awaited in dev/tests. See analytics.ts.
		const record = (status: SearchStatus, extra: { response?: SearchResponse; error?: string }) =>
			recordSearchEvent(locals.supabase, {
				orgId: context.kind === 'org' ? context.org.id : null,
				userId: user.id,
				query,
				dataSourceIds: requested,
				topK,
				rerank,
				status,
				...extra
			});

		if (forbidden.length > 0) {
			await record('forbidden', { error: `forbidden: ${forbidden.join(',')}` });
			return fail(403, {
				query,
				requested,
				answer,
				topK,
				rerank,
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
			return { query, requested, answer, topK, rerank, outcome, answerNotice: answerNotice(a) };
		}

		const detail = 'detail' in outcome ? outcome.detail : undefined;
		await record(FAILURE_STATUS[outcome.kind], {
			error: detail ? `${outcome.kind}: ${detail}` : outcome.kind
		});
		return fail(FAILURE_HTTP_STATUS[outcome.kind], {
			query,
			requested,
			answer,
			topK,
			rerank,
			failure: outcome
		});
	}
};
