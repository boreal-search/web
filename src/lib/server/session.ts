// Pieces of the session check in hooks.server.ts.
import { isAuthApiError, isAuthSessionMissingError, type User } from '@supabase/supabase-js';

/** Supabase's session cookies: `sb-<ref>-auth-token`, split into `.0`, `.1`… when large. */
export const isSessionCookie = (name: string) => /^sb-[a-z0-9]+-auth-token(\.\d+)?$/.test(name);

/** GET routes that write: an email link's code is spent on first use, so it must not race the check. */
const WRITES_ON_GET = new Set(['/auth/confirm']);

/**
 * Requests that may run while Supabase Auth confirms the session: reads, whose response is held
 * until it does. Anything else (form actions, POST endpoints) may write, so it waits.
 */
export const runsBeforeAuthCheck = (method: string, routeId: string | null) =>
	(method === 'GET' || method === 'HEAD') && !WRITES_ON_GET.has(routeId ?? '');

/**
 * Supabase Auth's answer about a session: `live`, `rejected` (signed out, deleted, banned: sign
 * the device out), or `unknown` (network, 5xx, rate limit: no answer, so serve nothing but keep
 * the session).
 */
export type SessionCheck = 'live' | 'rejected' | 'unknown';

export function sessionCheck(
	error: unknown,
	user: Pick<User, 'banned_until'> | null,
	now = Date.now()
): SessionCheck {
	if (isAuthSessionMissingError(error)) return 'rejected';
	if (isAuthApiError(error))
		return error.status >= 400 && error.status < 500 && error.status !== 429
			? 'rejected'
			: 'unknown';
	if (error || !user) return 'unknown';
	return user.banned_until && Date.parse(user.banned_until) > now ? 'rejected' : 'live';
}
