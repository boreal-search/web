import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { resolve as resolvePath } from '$app/paths';
import { createSupabaseServerClient } from '#lib/supabase/server.js';
import {
	isSessionCookie,
	runsBeforeAuthCheck,
	sessionCheck,
	type SessionCheck
} from '#lib/server/session.js';
import { parseTheme, THEME_COOKIE, THEME_COOKIE_OPTIONS } from '#lib/theme.js';

/**
 * Per-request Supabase client and the signed-in user on `event.locals`.
 *
 * The user comes from the session JWT, verified locally (asymmetric key, cached JWKS), so loads
 * start at once. A signed-out or banned session still carries a validly signed JWT until it
 * expires, so Supabase Auth must confirm it too (`getUser`). Reads run alongside that check
 * (RLS checks the JWT on every query) and their response is held until it passes; anything
 * that may write waits for it first. A session Auth rejects is cleared and the request is
 * answered as signed out; when Auth gives no answer, the request fails (503) and the session
 * stays.
 */
const supabase: Handle = async ({ event, resolve }) => {
	const client = createSupabaseServerClient(event.cookies);
	event.locals.supabase = client;
	event.locals.user = null;
	const requestTheme = event.cookies.get(THEME_COOKIE);
	const finish = () =>
		resolve(event, {
			// Supabase sets these when refreshing the session; let them through to the client.
			filterSerializedResponseHeaders: (name) =>
				name === 'content-range' || name === 'x-supabase-api-version'
		});

	// Refreshes an expired access token (Auth checks the refresh token then).
	const {
		data: { session }
	} = await client.auth.getSession();
	const token = session?.access_token;
	const claims = token ? (await client.auth.getClaims(token)).data?.claims : undefined;
	if (!token || !claims) return finish();
	event.locals.user = { id: claims.sub, email: claims.email };

	// With the token passed in, getUser takes no client lock, so queries run alongside it.
	const askAuth = () =>
		client.auth.getUser(token).then(
			({ data, error: e }) => sessionCheck(e, data.user),
			(): SessionCheck => 'unknown'
		);
	// One retry: a blip in Auth should neither sign the user out nor fail the page.
	const confirmed = askAuth().then((c) => (c === 'unknown' ? askAuth() : c));
	const signOut = () => {
		event.locals.user = null;
		for (const { name } of event.cookies.getAll())
			if (isSessionCookie(name)) event.cookies.delete(name, { path: '/' });
		// The root layout mirrors the user's saved theme into this cookie; that is theirs too.
		if (event.cookies.get(THEME_COOKIE) !== requestTheme) {
			if (requestTheme) event.cookies.set(THEME_COOKIE, requestTheme, THEME_COOKIE_OPTIONS);
			else event.cookies.delete(THEME_COOKIE, { path: THEME_COOKIE_OPTIONS.path });
		}
	};
	const unavailable = () => error(503, 'Sign-in could not be checked just now. Try again.');

	const read = runsBeforeAuthCheck(event.request.method, event.route.id);
	if (!read) {
		const check = await confirmed;
		if (check === 'unknown') unavailable();
		if (check === 'rejected') signOut();
	}
	if (event.locals.user && (event.url.pathname === '/login' || event.url.pathname === '/signup')) {
		redirect(303, resolvePath('/(app)/search'));
	}
	if (!read) return finish();

	const [response, check] = await Promise.all([finish(), confirmed]);
	if (check === 'live') return response;
	// Nothing of this response is sent.
	await response.body?.cancel();
	if (check === 'unknown') unavailable();
	// Ask again without the session.
	signOut();
	redirect(303, event.url.pathname + event.url.search);
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
