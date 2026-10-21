import { fail } from '@sveltejs/kit';
import { findForbiddenDataSources, getAccessibleDataSourceIds } from '#lib/server/access.js';
import { requireUser } from '#lib/server/auth.js';
import { engine, EngineError } from '#lib/server/engine.js';
import type { Actions, PageServerLoad } from './$types';

const MAX_TOP_K = 50;

export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { accessibleDataSourceIds } = await parent();
	const allowed = new Set(accessibleDataSourceIds);

	try {
		const all = await engine(fetch).listDataSources();
		return { dataSources: all.filter((ds) => allowed.has(ds.id)), engineError: null };
	} catch (e) {
		const message = e instanceof EngineError ? `${e.status} ${e.message}` : 'Engine unreachable';
		return { dataSources: [], engineError: message };
	}
};

export const actions: Actions = {
	default: async ({ request, locals, fetch }) => {
		const user = requireUser();
		const form = await request.formData();
		const query = String(form.get('query') ?? '').trim();
		const requested = form.getAll('data_source_ids').map(String);
		const topK = Math.min(Math.max(Number(form.get('top_k') ?? 10) || 10, 1), MAX_TOP_K);
		const rerank = form.get('rerank') !== 'off';

		if (!query) return fail(400, { query, requested, error: 'Enter a query.' });
		if (requested.length === 0) {
			return fail(400, { query, requested, error: 'Select at least one data source.' });
		}

		// Re-check access on every search; never trust the ids posted by the form.
		const accessible = await getAccessibleDataSourceIds(locals.supabase, user.id);
		const forbidden = findForbiddenDataSources(requested, accessible);
		if (forbidden.length > 0) {
			return fail(403, {
				query,
				requested,
				error: `No access to data source(s): ${forbidden.join(', ')}`
			});
		}

		try {
			const response = await engine(fetch).search({
				query,
				data_source_ids: requested,
				top_k: topK,
				rerank
			});
			return { query, requested, response };
		} catch (e) {
			const message = e instanceof EngineError ? `${e.status} ${e.message}` : 'Engine unreachable';
			return fail(502, { query, requested, error: message });
		}
	}
};
