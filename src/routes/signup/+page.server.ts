import { fail, redirect } from '@sveltejs/kit';
import { authErrorMessage, revealsAccount, validateNewPassword } from '#lib/server/credentials.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (!email.includes('@')) return fail(400, { email, error: 'Enter a valid email address.' });
		const invalid = validateNewPassword(password, confirm);
		if (invalid) return fail(400, { email, error: invalid });

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: { emailRedirectTo: `${url.origin}/auth/confirm?next=/` }
		});
		if (error && !revealsAccount(error)) {
			return fail(400, { email, error: authErrorMessage(error) });
		}

		// No session = "Confirm email" is on (required in production, see docs/decisions.md).
		// A taken email gets the same answer (and no email), so this reveals nothing.
		if (!data.session) return { sent: true, email };
		redirect(303, '/');
	}
};
