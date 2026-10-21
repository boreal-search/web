import { error } from '@sveltejs/kit';
import { engine, EngineError } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ params, url, parent, fetch }) => {
	const { accessibleDataSourceIds } = await parent();
	// 404 rather than 403 so we don't confirm that a data source exists.
	if (!accessibleDataSourceIds.includes(params.id)) error(404, 'Data source not found');

	const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
	const api = engine(fetch);

	try {
		const [dataSource, documents, jobs] = await Promise.all([
			api.getDataSource(params.id),
			api.listDocuments(params.id, { limit: PAGE_SIZE, offset }),
			api.listJobs({ data_source_id: params.id, limit: 20 })
		]);
		return { dataSource, documents, jobs, offset, pageSize: PAGE_SIZE };
	} catch (e) {
		if (e instanceof EngineError && e.status === 404) error(404, 'Data source not found');
		const message = e instanceof EngineError ? `${e.status} ${e.message}` : 'Engine unreachable';
		error(502, message);
	}
};
