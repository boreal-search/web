import { error } from '@sveltejs/kit';
import { classifyEngineError, engine, EngineError } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

// 404 rather than 403 so we don't confirm that a data source exists.
const notFound = () =>
	error(404, 'Data source not found', { failure: { kind: 'not_found', what: 'data_source' } });

export const load: PageServerLoad = async ({ params, url, parent, fetch }) => {
	const { access } = await parent();
	if (!access.dataSourceIds.includes(params.id)) notFound();
	// Known without the engine: the id and which group grants it.
	const group = access.groups.find((g) => g.ids.includes(params.id))?.label ?? null;

	const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
	const api = engine(fetch);

	try {
		const [dataSource, documents, jobs] = await Promise.all([
			api.getDataSource(params.id),
			api.listDocuments(params.id, { limit: PAGE_SIZE, offset }),
			api.listJobs({ data_source_id: params.id, limit: 20 })
		]);
		return {
			id: params.id,
			group,
			detail: { dataSource, documents, jobs },
			engineFailure: null,
			offset,
			pageSize: PAGE_SIZE
		};
	} catch (e) {
		if (e instanceof EngineError && e.status === 404) notFound();
		// Engine down: render the head from what we know, with a notice instead of the tables.
		return {
			id: params.id,
			group,
			detail: null,
			engineFailure: classifyEngineError(e),
			offset,
			pageSize: PAGE_SIZE
		};
	}
};
