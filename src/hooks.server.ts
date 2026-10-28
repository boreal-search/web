import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { createSupabaseServerClient } from '#lib/supabase/server.js';
import { parseTheme, THEME_COOKIE } from '#lib/theme.js';

/** Attach a per-request Supabase client and a validated session to `event.locals`. */
const supabase: Handle = async ({ event, resolve }) => {
	event.locals.theme = 'system';
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		// getUser() validates the JWT with Supabase Auth; getSession() alone trusts the cookie.
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };

		return { session, user };
	};

	return resolve(event, {
		// Supabase sets these when refreshing the session; let them through to the client.
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

/** Resolve the session once per request; routes under /(app) are guarded in their layout load. */
const auth: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	if (user && (event.url.pathname === '/login' || event.url.pathname === '/signup')) {
		redirect(303, '/');
	}

	return resolve(event);
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

export const handle = sequence(supabase, auth, theme);
export { handleError } from '#lib/server/errors.js';
