import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/supabase/types.js';

/** Must match `[auth] minimum_password_length` in supabase/config.toml and the hosted project. */
export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt ignores bytes past 72; Supabase Auth rejects longer passwords. */
const MAX_PASSWORD_LENGTH = 72;
/** How long after following a reset link the user may set a password without the current one. */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

/** Server-side check for a new password + its confirmation. Returns an error message or null. */
export function validateNewPassword(password: string, confirm: string): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
	}
	if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
		return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
	}
	if (password !== confirm) return "The passwords don't match.";
	return null;
}

/**
 * User-facing message for a Supabase Auth error. Never says whether an account exists:
 * sign-up for a taken email and reset for an unknown one succeed silently upstream, and
 * everything account-specific collapses into "invalid email or password".
 */
export function authErrorMessage(error: Pick<AuthError, 'code' | 'status'>): string {
	switch (error.code) {
		case 'invalid_credentials':
		case 'user_not_found':
		case 'user_already_exists':
		case 'email_exists':
			return 'Invalid email or password.';
		case 'email_not_confirmed':
			return 'Confirm your email first: follow the link we sent you.';
		case 'weak_password':
			return 'That password is too weak or too common. Choose a longer, less predictable one.';
		case 'same_password':
			return 'Choose a password different from your current one.';
		case 'email_address_invalid':
			return 'Enter a valid email address.';
		case 'signup_disabled':
		case 'email_provider_disabled':
			return 'Sign-up is currently disabled.';
		case 'over_email_send_rate_limit':
		case 'over_request_rate_limit':
			return 'Too many attempts. Wait a few minutes and try again.';
		case 'reauthentication_needed':
		case 'session_expired':
		case 'session_not_found':
			return 'Your session expired. Log in again.';
	}
	if (error.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
	return 'Something went wrong. Try again in a moment.';
}

/**
 * Errors from signUp / resetPasswordForEmail that only happen for an address that already has
 * an account: "already registered" (Supabase returns it instead of a decoy user whenever any
 * autoconfirm is on) and the per-address email cooldown. Forms answer these exactly like a
 * success, so the response never tells whether the account exists.
 */
export function revealsAccount(error: Pick<AuthError, 'code'>): boolean {
	return (
		error.code === 'user_already_exists' ||
		error.code === 'email_exists' ||
		error.code === 'over_email_send_rate_limit'
	);
}

export type AmrEntry = { method: string; timestamp: number };

/**
 * True when the session was established by a password-reset link (AMR method `recovery`)
 * within the last RECOVERY_WINDOW_SECONDS. The AMR claim is in the signed JWT, so the caller
 * must have validated it (`auth.getClaims()`).
 */
export function isRecentRecovery(amr: unknown, nowSeconds: number): boolean {
	if (!Array.isArray(amr)) return false;
	return amr.some(
		(e: Partial<AmrEntry>) =>
			e?.method === 'recovery' &&
			typeof e.timestamp === 'number' &&
			nowSeconds - e.timestamp >= -60 &&
			nowSeconds - e.timestamp <= RECOVERY_WINDOW_SECONDS
	);
}

/**
 * True when the current session came from a password-reset link in the last few minutes.
 * `getClaims()` verifies the JWT (signature or getUser), so its AMR can be trusted.
 */
export async function hasRecentRecovery(supabase: SupabaseClient<Database>): Promise<boolean> {
	const { data, error } = await supabase.auth.getClaims();
	if (error || !data) return false;
	return isRecentRecovery(data.claims.amr, Math.floor(Date.now() / 1000));
}
