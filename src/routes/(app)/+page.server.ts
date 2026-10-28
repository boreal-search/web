import { withDataSources } from '#lib/server/access.js';
import { engine, engineErrorMessage } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { access } = await parent();
	if (access.dataSourceIds.length === 0) return { groups: [], engineError: null };

	try {
		return {
			groups: withDataSources(access.groups, await engine(fetch).listDataSources()),
			engineError: null
		};
	} catch (e) {
		// Engine unreachable (workstation off, tunnel down): render the page with a notice.
		return { groups: [], engineError: engineErrorMessage(e) };
	}
};
