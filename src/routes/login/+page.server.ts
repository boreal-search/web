import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { safeRedirect } from '#lib/server/auth.js';
import { authErrorMessage, parseEmail } from '#lib/server/credentials.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return {
		redirectTo: safeRedirect(url.searchParams.get('redirectTo')),
		// Set by /auth/confirm when an email link (sign-in, sign-up or reset) can't be used.
		linkError:
			url.searchParams.get('error') === 'invalid_link'
				? 'That link is invalid or has expired.'
				: null
	};
};

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const form = await request.formData();
		const typed = String(form.get('email') ?? '').trim();
		const email = parseEmail(typed);
		const redirectTo = safeRedirect(form.get('redirectTo'));
		const password = String(form.get('password') ?? '');

		if (!email) return fail(400, { email: typed, error: 'Enter a valid email address.' });

		// Password set: sign in directly (users created in the Supabase dashboard have one).
		if (password) {
			const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
			if (error) return fail(400, { email, error: authErrorMessage(error) });
			redirect(303, redirectTo);
		}

		// Magic link: Supabase emails a link to /auth/confirm, which exchanges the token for a session.
		const confirm = new URL(resolve('/auth/confirm'), url.origin);
		confirm.searchParams.set('next', redirectTo);

		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: confirm.toString() }
		});

		if (error) {
			return fail(400, { email, error: authErrorMessage(error) });
		}
		return { sent: true, email };
	}
};
