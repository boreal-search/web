import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
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
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const nextParam = url.searchParams.get('next') ?? '/';
	const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

	// Recovery token_hash: verified on /account/password when the new password is submitted,
	// because the resulting session is indistinguishable from a magic-link one.
	if (tokenHash && type === 'recovery') {
		redirect(303, `/account/password?${new URLSearchParams({ token_hash: tokenHash })}`);
	}

	let ok = false;
	if (code) {
		ok = !(await locals.supabase.auth.exchangeCodeForSession(code)).error;
	} else if (tokenHash && type && OTP_TYPES.includes(type)) {
		ok = !(await locals.supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
	}
	if (!ok) redirect(303, '/login?error=invalid_link');

	// A PKCE code doesn't say what the link was for; the new session's AMR does.
	redirect(303, (await hasRecentRecovery(locals.supabase)) ? '/account/password' : next);
};
