import { describe, expect, it } from 'vitest';
import {
	authErrorMessage,
	isRecentRecovery,
	MIN_PASSWORD_LENGTH,
	RECOVERY_WINDOW_SECONDS,
	revealsAccount,
	validateNewPassword
} from './credentials';

describe('validateNewPassword', () => {
	it('accepts a long-enough matching password', () => {
		expect(validateNewPassword('correct horse', 'correct horse')).toBeNull();
		expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH), 'a'.repeat(8))).toBeNull();
	});

	it('rejects passwords shorter than the minimum', () => {
		expect(validateNewPassword('short', 'short')).toBe('Use at least 8 characters.');
		expect(validateNewPassword('', '')).toBe('Use at least 8 characters.');
	});

	it('rejects passwords over 72 bytes, counting multi-byte characters', () => {
		expect(validateNewPassword('a'.repeat(73), 'a'.repeat(73))).toBe('Use at most 72 characters.');
		expect(validateNewPassword('é'.repeat(37), 'é'.repeat(37))).toBe('Use at most 72 characters.');
	});

	it('rejects a mismatched confirmation', () => {
		expect(validateNewPassword('correct horse', 'correct house')).toBe(
			"The passwords don't match."
		);
	});
});

describe('authErrorMessage', () => {
	it('never distinguishes unknown accounts from wrong passwords', () => {
		const a = authErrorMessage({ code: 'invalid_credentials', status: 400 });
		expect(authErrorMessage({ code: 'user_not_found', status: 404 })).toBe(a);
		expect(authErrorMessage({ code: 'user_already_exists', status: 422 })).toBe(a);
		expect(a).toBe('Invalid email or password.');
	});

	it('explains weak passwords and rate limits', () => {
		expect(authErrorMessage({ code: 'weak_password', status: 422 })).toMatch(/too weak/);
		expect(authErrorMessage({ code: 'over_email_send_rate_limit', status: 429 })).toMatch(
			/Too many attempts/
		);
		expect(authErrorMessage({ code: undefined, status: 429 })).toMatch(/Too many attempts/);
	});

	it('falls back to a generic message without echoing upstream text', () => {
		expect(authErrorMessage({ code: 'unexpected_failure', status: 500 })).toBe(
			'Something went wrong. Try again in a moment.'
		);
	});
});

describe('revealsAccount', () => {
	it('flags errors that only an existing account produces', () => {
		expect(revealsAccount({ code: 'user_already_exists' })).toBe(true);
		expect(revealsAccount({ code: 'email_exists' })).toBe(true);
		expect(revealsAccount({ code: 'over_email_send_rate_limit' })).toBe(true);
	});

	it('lets other errors through', () => {
		expect(revealsAccount({ code: 'weak_password' })).toBe(false);
		expect(revealsAccount({ code: 'over_request_rate_limit' })).toBe(false);
		expect(revealsAccount({ code: undefined })).toBe(false);
	});
});

describe('isRecentRecovery', () => {
	const now = 1_800_000_000;

	it('accepts a recovery entry inside the window', () => {
		expect(isRecentRecovery([{ method: 'recovery', timestamp: now - 60 }], now)).toBe(true);
		expect(
			isRecentRecovery([{ method: 'recovery', timestamp: now - RECOVERY_WINDOW_SECONDS }], now)
		).toBe(true);
	});

	it('rejects stale recovery and other methods', () => {
		expect(
			isRecentRecovery([{ method: 'recovery', timestamp: now - RECOVERY_WINDOW_SECONDS - 1 }], now)
		).toBe(false);
		expect(isRecentRecovery([{ method: 'password', timestamp: now }], now)).toBe(false);
		expect(isRecentRecovery([{ method: 'otp', timestamp: now }], now)).toBe(false);
	});

	it('rejects malformed claims', () => {
		expect(isRecentRecovery(undefined, now)).toBe(false);
		expect(isRecentRecovery(['recovery'], now)).toBe(false);
		expect(isRecentRecovery([{ method: 'recovery' }], now)).toBe(false);
	});
});
