import { redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

/** Call from any server load/action: returns the validated user or redirects to /login. */
export function requireUser() {
	const { locals, url } = getRequestEvent();
	if (!locals.user) {
		const redirectTo = url.pathname + url.search;
		redirect(303, `/login?${new URLSearchParams({ redirectTo })}`);
	}
	return locals.user;
}
