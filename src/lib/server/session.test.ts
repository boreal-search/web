import { describe, expect, it } from 'vitest';
import {
	AuthApiError,
	AuthRetryableFetchError,
	AuthSessionMissingError,
	AuthUnknownError
} from '@supabase/supabase-js';
import { isSessionCookie, runsBeforeAuthCheck, sessionCheck } from './session';

describe('isSessionCookie', () => {
	it('matches the session cookie and its chunks', () => {
		expect(isSessionCookie('sb-okmdatkejnfdkqtivixt-auth-token')).toBe(true);
		expect(isSessionCookie('sb-okmdatkejnfdkqtivixt-auth-token.0')).toBe(true);
		expect(isSessionCookie('sb-okmdatkejnfdkqtivixt-auth-token.12')).toBe(true);
	});

	it('leaves the app cookies alone', () => {
		for (const name of [
			'boreal_org',
			'boreal_theme',
			'sb-x-auth-token-code-verifier',
			'x-sb-a-auth-token'
		])
			expect(isSessionCookie(name)).toBe(false);
	});
});

describe('runsBeforeAuthCheck', () => {
	it('lets reads run alongside the check', () => {
		expect(runsBeforeAuthCheck('GET', '/(app)/search')).toBe(true);
		expect(runsBeforeAuthCheck('HEAD', '/(app)/search')).toBe(true);
		expect(runsBeforeAuthCheck('GET', null)).toBe(true);
	});

	it('makes anything that may write wait for it', () => {
		for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
			expect(runsBeforeAuthCheck(m, '/(app)/search')).toBe(false);
		expect(runsBeforeAuthCheck('GET', '/auth/confirm')).toBe(false);
	});
});

describe('sessionCheck', () => {
	const now = Date.parse('2026-01-01T00:00:00Z');
	const user = { banned_until: undefined };

	it('is live when Auth returns the user', () => {
		expect(sessionCheck(null, user, now)).toBe('live');
		expect(sessionCheck(null, { banned_until: '2025-01-01T00:00:00Z' }, now)).toBe('live');
	});

	it('is rejected when Auth says no', () => {
		expect(sessionCheck(new AuthSessionMissingError(), null, now)).toBe('rejected');
		for (const status of [400, 401, 403, 404])
			expect(sessionCheck(new AuthApiError('no', status, undefined), null, now)).toBe('rejected');
		expect(sessionCheck(null, { banned_until: '2027-01-01T00:00:00Z' }, now)).toBe('rejected');
	});

	it('is unknown when Auth gives no answer', () => {
		expect(sessionCheck(new AuthRetryableFetchError('fetch failed', 0), null, now)).toBe('unknown');
		expect(sessionCheck(new AuthRetryableFetchError('bad gateway', 502), null, now)).toBe(
			'unknown'
		);
		expect(sessionCheck(new AuthApiError('slow down', 429, undefined), null, now)).toBe('unknown');
		expect(sessionCheck(new AuthApiError('oops', 500, undefined), null, now)).toBe('unknown');
		expect(sessionCheck(new AuthUnknownError('not json', null), null, now)).toBe('unknown');
	});
});
