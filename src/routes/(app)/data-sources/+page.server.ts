import { getAccess, withDataSources } from '#lib/server/access.js';
import { requireUser } from '#lib/server/auth.js';
import { allDataSources, settle } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

/** The current context's data sources; switching context switches the list. Names stream in. */
export const load: PageServerLoad = async () => {
	requireUser();
	const access = await getAccess();
	const list = access.dataSourceIds.length > 0 ? allDataSources() : Promise.resolve([]);
	return { groups: settle(list.then((l) => withDataSources(access.groups, l))) };
};
