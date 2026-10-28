import { loadAccessRequest, type AccessRequestState } from '#lib/server/access-requests.js';
import { withDataSources } from '#lib/server/access.js';
import { classifyEngineError, engine } from '#lib/server/engine.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, fetch, locals }) => {
	const { access } = await parent();
	// No org: offer "request access" (or show the open request). Null for org members.
	const accessRequest: Promise<AccessRequestState | null> =
		access.memberships.length === 0 && locals.user
			? loadAccessRequest(locals.supabase, locals.user.id)
			: Promise.resolve(null);

	if (access.dataSourceIds.length === 0) {
		return { groups: [], engineFailure: null, accessRequest: await accessRequest };
	}

	try {
		const [list, request] = await Promise.all([engine(fetch).listDataSources(), accessRequest]);
		return {
			groups: withDataSources(access.groups, list),
			engineFailure: null,
			accessRequest: request
		};
	} catch (e) {
		// Engine down (workstation off, tunnel down): the page lists ids from access instead.
		return {
			groups: [],
			engineFailure: classifyEngineError(e),
			accessRequest: await accessRequest
		};
	}
};
