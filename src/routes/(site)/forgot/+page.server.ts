import { fail } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { authErrorMessage, parseEmail, revealsAccount } from '#lib/server/credentials.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const form = await request.formData();
		const typed = String(form.get('email') ?? '').trim();
		const email = parseEmail(typed);
		if (!email) return fail(400, { email: typed, error: 'Enter a valid email address.' });

		const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}${resolve('/auth/confirm')}?next=${resolve('/(site)/account/password')}`
		});
		// Supabase succeeds for unknown emails too; the per-address cooldown only hits real ones.
		if (error && !revealsAccount(error)) {
			return fail(400, { email, error: authErrorMessage(error) });
		}
		return { sent: true, email };
	}
};
