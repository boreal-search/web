import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import {
	authErrorMessage,
	parseEmail,
	revealsAccount,
	validateNewPassword
} from '#lib/server/credentials.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const form = await request.formData();
		const typed = String(form.get('email') ?? '').trim();
		const email = parseEmail(typed);
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (!email) return fail(400, { email: typed, error: 'Enter a valid email address.' });
		const invalid = validateNewPassword(password, confirm);
		if (invalid) return fail(400, { email, error: invalid });

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${url.origin}${resolve('/auth/confirm')}?next=${resolve('/(app)/search')}`
			}
		});
		if (error && !revealsAccount(error)) {
			return fail(400, { email, error: authErrorMessage(error) });
		}

		// No session = "Confirm email" is on (required in production, see docs/decisions.md).
		// A taken email gets the same answer (and no email), so this reveals nothing.
		if (!data.session) return { sent: true, email };
		redirect(303, resolve('/(app)/search'));
	}
};
