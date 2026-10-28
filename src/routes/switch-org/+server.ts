import { error, redirect } from '@sveltejs/kit';
import { CONTEXT_COOKIE, contextValue, getAccess } from '#lib/server/access.js';
import { requireUser, safeRedirect } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The nav switcher's form POST (works without JS): store the chosen context (org slug or
 * `public`) in a per-device cookie and go back. `getAccess` re-validates the cookie against
 * the user's memberships on every request; checking here too gives a forged value a 400.
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const user = requireUser();
	const form = await request.formData();
	const wanted = String(form.get('org') ?? '');
	const { contexts } = await getAccess(locals.supabase, user.id, undefined);
	if (!contexts.some((c) => contextValue(c) === wanted)) error(400, 'You are not in that org.');

	cookies.set(CONTEXT_COOKIE, wanted, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: ONE_YEAR
	});
	redirect(303, safeRedirect(form.get('redirectTo')));
};
