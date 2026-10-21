import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { createSupabaseServerClient } from '#lib/supabase/server.js';

/** Attach a per-request Supabase client and a validated session to `event.locals`. */
const supabase: Handle = async ({ event, resolve }) => {
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

	if (user && event.url.pathname === '/login') {
		redirect(303, '/');
	}

	return resolve(event);
};

export const handle = sequence(supabase, auth);
