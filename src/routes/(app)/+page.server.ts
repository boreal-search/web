import { engine, engineErrorMessage } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { accessibleDataSourceIds } = await parent();
	if (accessibleDataSourceIds.length === 0) return { dataSources: [], engineError: null };
	const allowed = new Set(accessibleDataSourceIds);

	try {
		const all = await engine(fetch).listDataSources();
		return { dataSources: all.filter((ds) => allowed.has(ds.id)), engineError: null };
	} catch (e) {
		// Engine unreachable (workstation off, tunnel down): render the page with a notice.
		return { dataSources: [], engineError: engineErrorMessage(e) };
	}
};
