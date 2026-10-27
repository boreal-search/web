import { fail } from '@sveltejs/kit';
import { findForbiddenDataSources, getAccessGrants, resolveSearchOrg } from '#lib/server/access.js';
import { recordSearchEvent } from '#lib/server/analytics.js';
import { requireUser } from '#lib/server/auth.js';
import { engine, engineErrorMessage, type SearchResponse } from '#lib/server/engine.js';
import type { Actions, PageServerLoad } from './$types';

const MAX_TOP_K = 50;

export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { accessibleDataSourceIds } = await parent();
	const allowed = new Set(accessibleDataSourceIds);

	try {
		const all = await engine(fetch).listDataSources();
		return { dataSources: all.filter((ds) => allowed.has(ds.id)), engineError: null };
	} catch (e) {
		return { dataSources: [], engineError: engineErrorMessage(e) };
	}
};

export const actions: Actions = {
	default: async ({ request, locals, fetch, platform }) => {
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
		const grants = await getAccessGrants(locals.supabase, user.id);
		const accessible = [...new Set(grants.map((g) => g.data_source_id))];
		const forbidden = findForbiddenDataSources(requested, accessible);
		const orgId = resolveSearchOrg(requested, grants);

		// Analytics: fire-and-forget on Workers via waitUntil; awaited elsewhere (dev/tests).
		const waitUntil = platform?.ctx ? platform.ctx.waitUntil.bind(platform.ctx) : undefined;
		const record = (
			status: 'ok' | 'forbidden' | 'engine_error',
			extra: { response?: SearchResponse; error?: string }
		) => {
			if (!orgId) return Promise.resolve();
			return recordSearchEvent(
				locals.supabase,
				{
					orgId,
					userId: user.id,
					query,
					dataSourceIds: requested,
					topK,
					rerank,
					status,
					...extra
				},
				waitUntil
			);
		};

		if (forbidden.length > 0) {
			await record('forbidden', { error: `forbidden: ${forbidden.join(',')}` });
			return fail(403, {
				query,
				requested,
				answer,
				error: `No access to data source(s): ${forbidden.join(', ')}`
			});
		}

		try {
			const { response, answerError } = await engine(fetch).search({
				query,
				data_source_ids: requested,
				top_k: topK,
				rerank,
				answer
			});
			await record('ok', { response });
			return { query, requested, answer, response, answerError };
		} catch (e) {
			const message = engineErrorMessage(e);
			await record('engine_error', { error: message });
			return fail(502, { query, requested, answer, error: message });
		}
	}
};
