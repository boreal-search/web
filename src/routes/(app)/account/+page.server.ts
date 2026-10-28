import { fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { authErrorMessage, validateNewPassword } from '#lib/server/credentials.js';
import { parseTheme, THEME_COOKIE, THEME_COOKIE_OPTIONS } from '#lib/theme.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const user = requireUser();
	return { email: user.email ?? '', updated: url.searchParams.has('updated') };
};

export const actions: Actions = {
	/** Change password: re-verify the current one first, so a hijacked session can't take over. */
	password: async ({ request, locals }) => {
		const user = requireUser();
		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const password = String(form.get('password') ?? '');
		const invalid = validateNewPassword(password, String(form.get('confirm') ?? ''));
		if (invalid) return fail(400, { error: invalid });
		if (!user.email || !current) return fail(400, { error: 'Enter your current password.' });

		// Signing in again also gives a fresh session, which `secure_password_change` accepts.
		const { error: wrong } = await locals.supabase.auth.signInWithPassword({
			email: user.email,
			password: current
		});
		if (wrong) {
			const message =
				wrong.code === 'invalid_credentials'
					? 'Your current password is incorrect.'
					: authErrorMessage(wrong);
			return fail(400, { error: message });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) return fail(400, { error: authErrorMessage(error) });
		return { updated: true };
	},

	/**
	 * Theme: the profile row is the source of truth (the root layout mirrors it into the cookie on
	 * every load), so the cookie changes only once the row is saved.
	 */
	theme: async ({ request, locals, cookies }) => {
		const user = requireUser();
		const theme = parseTheme((await request.formData()).get('theme'));
		const { error } = await locals.supabase.from('profiles').update({ theme }).eq('id', user.id);
		if (error) return fail(503, { themeSaved: 'failed' as const });
		cookies.set(THEME_COOKIE, theme, THEME_COOKIE_OPTIONS);
		locals.theme = theme;
		return { themeSaved: 'account' as const };
	}
};
