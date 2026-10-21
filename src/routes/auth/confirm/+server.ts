import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

const OTP_TYPES: EmailOtpType[] = [
	'magiclink',
	'email',
	'signup',
	'recovery',
	'invite',
	'email_change'
];

/** Target of the magic-link email: exchanges token_hash for a session cookie, then redirects. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const nextParam = url.searchParams.get('next') ?? '/';
	const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

	if (tokenHash && type && OTP_TYPES.includes(type)) {
		const { error } = await locals.supabase.auth.verifyOtp({ type, token_hash: tokenHash });
		if (!error) redirect(303, next);
	}

	redirect(303, '/login?error=invalid_link');
};
