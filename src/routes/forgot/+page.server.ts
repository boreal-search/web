import { fail } from '@sveltejs/kit';
import { authErrorMessage, revealsAccount } from '#lib/server/credentials.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email.includes('@')) return fail(400, { email, error: 'Enter a valid email address.' });

		const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/auth/confirm?next=/account/password`
		});
		// Supabase succeeds for unknown emails too; the per-address cooldown only hits real ones.
		if (error && !revealsAccount(error)) {
			return fail(400, { email, error: authErrorMessage(error) });
		}
		return { sent: true, email };
	}
};
