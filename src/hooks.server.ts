import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { resolve as resolvePath } from '$app/paths';
import { createSupabaseServerClient } from '#lib/supabase/server.js';
import { parseTheme, THEME_COOKIE } from '#lib/theme.js';

/** Per-request Supabase client and the validated user on `event.locals`. */
const supabase: Handle = async ({ event, resolve }) => {
	const client = createSupabaseServerClient(event.cookies);
	event.locals.supabase = client;
	event.locals.user = null;

	const {
		data: { session }
	} = await client.auth.getSession();
	if (session) {
		// getUser() validates the JWT with Supabase Auth; getSession() alone trusts the cookie.
		const {
			data: { user },
			error
		} = await client.auth.getUser();
		if (!error) event.locals.user = user;
	}

	if (event.locals.user && (event.url.pathname === '/login' || event.url.pathname === '/signup')) {
		redirect(303, resolvePath('/(app)/search'));
	}

	return resolve(event, {
		// Supabase sets these when refreshing the session; let them through to the client.
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

/**
 * Render `<html data-theme>` from the theme cookie (the root layout load swaps in the signed-in
 * user's saved choice), so a forced light/dark theme paints with no flash. `system` matches no
 * CSS selector and follows `prefers-color-scheme`.
 */
const theme: Handle = async ({ event, resolve }) => {
	event.locals.theme = parseTheme(event.cookies.get(THEME_COOKIE));
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%boreal.theme%', event.locals.theme)
	});
};

export const handle = sequence(supabase, theme);
export { handleError } from '#lib/server/errors.js';
