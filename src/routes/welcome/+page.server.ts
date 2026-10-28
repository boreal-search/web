import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

/** The logged-out splash. Signed in, `/` is the dashboard. */
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, resolve('/(app)'));
};
