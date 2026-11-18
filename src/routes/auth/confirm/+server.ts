import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import { resolve } from '$app/paths';
import { safeRedirect } from '#lib/server/auth.js';
import { hasRecentRecovery } from '#lib/server/credentials.js';
import type { RequestHandler } from './$types';

const OTP_TYPES: EmailOtpType[] = [
	'magiclink',
	'email',
	'signup',
	'recovery',
	'invite',
	'email_change'
];

/**
 * Target of every auth email: exchanges the link's credential for a session cookie, then
 * redirects. Accepts `?token_hash=&type=` (our templates in supabase/templates) and `?code=`
 * (PKCE, Supabase's default {{ .ConfirmationURL }} template). Reset links always land on
 * /account/password, whatever `next` says; any failure goes to /login with a message.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const tokenHash = url.searchParams.get('token_hash');
	const typeParam = url.searchParams.get('type');
	const type = OTP_TYPES.find((t) => t === typeParam);
	const next = safeRedirect(url.searchParams.get('next'));

	// Recovery token_hash: verified on /account/password when the new password is submitted,
	// because the resulting session is indistinguishable from a magic-link one.
	if (tokenHash && type === 'recovery') {
		redirect(
			303,
			`${resolve('/(site)/account/password')}?${new URLSearchParams({ token_hash: tokenHash })}`
		);
	}

	let ok = false;
	if (code) {
		ok = !(await locals.supabase.auth.exchangeCodeForSession(code)).error;
	} else if (tokenHash && type) {
		ok = !(await locals.supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
	}
	if (!ok) redirect(303, `${resolve('/(site)/login')}?error=invalid_link`);

	// A PKCE code doesn't say what the link was for; the new session's AMR does.
	redirect(
		303,
		(await hasRecentRecovery(locals.supabase)) ? resolve('/(site)/account/password') : next
	);
};
