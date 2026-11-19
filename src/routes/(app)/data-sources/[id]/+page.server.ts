import type { Loaded } from '#lib/failure.js';
import { engine, settle } from '#lib/server/engine.js';
import { notFound } from '#lib/server/files.js';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

/** The head renders from access (id, granting group); the engine's detail streams in. */
export const load: PageServerLoad = async ({ params, url, parent, fetch }) => {
	const { access, nav } = await parent();
	if (!access.dataSourceIds.includes(params.id)) notFound();
	const group = access.groups.find((g) => g.ids.includes(params.id))?.label ?? null;

	const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
	const api = engine(fetch);
	// Ingestion jobs are platform admins' business; nobody else's load asks the engine for them.
	const showJobs = nav?.isPlatformAdmin ?? false;
	const read = Promise.all([
		api.getDataSource(params.id),
		api.listDocuments(params.id, { limit: PAGE_SIZE, offset }),
		showJobs ? api.listJobs({ data_source_id: params.id, limit: 20 }) : null
	]).then(([dataSource, documents, jobs]) => ({ dataSource, documents, jobs }));

	return {
		id: params.id,
		group,
		showJobs,
		// Streamed, so the 404 status is gone by then: an engine 404 renders as a notice.
		detail: settle(read).then((r): Loaded<Awaited<typeof read>> =>
			!r.ok && r.failure.kind === 'error' && r.failure.status === 404
				? { ok: false, failure: { kind: 'not_found', what: 'data_source' } }
				: r
		),
		offset,
		pageSize: PAGE_SIZE
	};
};
