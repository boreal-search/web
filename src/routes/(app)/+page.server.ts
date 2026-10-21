import { engine, EngineError } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { accessibleDataSourceIds } = await parent();
	const allowed = new Set(accessibleDataSourceIds);

	try {
		const all = await engine(fetch).listDataSources();
		return { dataSources: all.filter((ds) => allowed.has(ds.id)), engineError: null };
	} catch (e) {
		// Engine unreachable (workstation off, tunnel down): render the page with a notice.
		const message = e instanceof EngineError ? `${e.status} ${e.message}` : 'Engine unreachable';
		return { dataSources: [], engineError: message };
	}
};
