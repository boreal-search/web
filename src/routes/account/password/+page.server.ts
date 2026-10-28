import { fail, redirect } from '@sveltejs/kit';
import {
	authErrorMessage,
	hasRecentRecovery,
	validateNewPassword
} from '#lib/server/credentials.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * Set a new password from a reset link, without the current password. The proof is either
 * - `?token_hash=` from our recovery email, passed through unused by /auth/confirm and
 *   consumed (verifyOtp) only when the new password is submitted, or
 * - a session from the PKCE `?code=` link, whose JWT AMR says `recovery` (minutes old).
 * A token_hash session can't be told apart from a magic-link one (both AMR `otp`), hence
 * the deferred verify. Anyone else changes their password on /account with the current one.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	if (url.searchParams.get('token_hash')) return;
	if (await hasRecentRecovery(locals.supabase)) return;
	redirect(303, locals.user ? '/account' : '/login?error=invalid_link');
};

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const invalid = validateNewPassword(password, String(form.get('confirm') ?? ''));
		if (invalid) return fail(400, { error: invalid, expired: false });

		const tokenHash = url.searchParams.get('token_hash');
		if (tokenHash) {
			const { error } = await locals.supabase.auth.verifyOtp({
				type: 'recovery',
				token_hash: tokenHash
			});
			if (error)
				return fail(400, { error: 'This reset link is invalid or has expired.', expired: true });
		} else if (!(await hasRecentRecovery(locals.supabase))) {
			return fail(400, { error: 'This reset link has expired.', expired: true });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) return fail(400, { error: authErrorMessage(error), expired: false });
		redirect(303, '/account?updated');
	}
};
