import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { requireUser } from '#lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

/** Everything under (app) requires a session. Child loads read `access` via `await parent()`. */
export const load: LayoutServerLoad = async ({ locals, route, parent }) => {
	// Logged out, `/` is the splash; every other (app) page goes to log in.
	if (!locals.user && route.id === '/(app)') redirect(303, resolve('/welcome'));
	requireUser();
	const { access } = await parent();
	// The root layout loads access for every signed-in user.
	if (!access) error(500, 'Access not loaded');
	return { access };
};
