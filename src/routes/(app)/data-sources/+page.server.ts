import { withDataSources } from '#lib/server/access.js';
import { classifyEngineError, engine } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

/** The current context's data sources; switching context switches the list. */
export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { access } = await parent();
	if (access.dataSourceIds.length === 0) return { groups: [], engineFailure: null };
	try {
		const list = await engine(fetch).listDataSources();
		return { groups: withDataSources(access.groups, list), engineFailure: null };
	} catch (e) {
		// Engine down (engine host off or unreachable): the page lists ids from access instead.
		return { groups: [], engineFailure: classifyEngineError(e) };
	}
};
