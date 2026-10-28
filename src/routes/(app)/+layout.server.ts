import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

/** Everything under (app) requires a session. Child loads read `access` via `await parent()`. */
export const load: LayoutServerLoad = async ({ parent }) => {
	requireUser();
	const { access } = await parent();
	// The root layout loads access for every signed-in user.
	if (!access) error(500, 'Access not loaded');
	return { access };
};
