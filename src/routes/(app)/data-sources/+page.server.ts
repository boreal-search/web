import { withDataSources } from '#lib/server/access.js';
import { engine, settle } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

/** The current context's data sources; switching context switches the list. Names stream in. */
export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { access } = await parent();
	const list =
		access.dataSourceIds.length > 0 ? engine(fetch).listDataSources() : Promise.resolve([]);
	return { groups: settle(list.then((l) => withDataSources(access.groups, l))) };
};
