import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	ENGINE_URL: 'https://engine.test/',
	FILE_SIGNING_KEY: 'test-signing-key'
}));
vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));

const { documentKey, isValidKey, pageKey, sign, signFileUrl } = await import('./files');

const DOC = '0b6c3a1e-5d2f-4c8a-9e7b-1f2a3b4c5d6e';

describe('signing', () => {
	// Expected hex from the engine's scheme:
	// python3 -c 'import hmac,hashlib; print(hmac.new(b"test-signing-key",
	//   b"pages/sara-registry/<DOC>/12.webp\n1800000000", hashlib.sha256).hexdigest())'
	it('matches the engine for a page render', () => {
		expect(sign('test-signing-key', pageKey('sara-registry', DOC, 12), 1_800_000_000)).toBe(
			'cf603864878d1c372d1a11b82d6566aede66f3e3bee3421bdce4c3922d34bfbf'
		);
	});

	it('matches the engine for a PDF', () => {
		expect(sign('test-signing-key', documentKey('sara-registry', DOC), 1_800_000_000)).toBe(
			'66137f84e3684975b10f89d985b3bdc349cbd1babcfcb3b8b894796c38631407'
		);
	});

	it('signs a /files/ URL on the engine origin, expiring on a ttl boundary', () => {
		const key = pageKey('sara-registry', DOC, 12);
		// 1_799_999_100 is a 900 s boundary: valid until two windows on.
		const url = signFileUrl(key, 900, 1_799_999_100 + 1);
		expect(url).toBe(
			`https://engine.test/files/${key}?exp=1800000900&sig=${sign('test-signing-key', key, 1_800_000_900)}`
		);
		// Same window, same URL, so caches hit.
		expect(signFileUrl(key, 900, 1_799_999_100 + 899)).toBe(url);
	});
});

describe('isValidKey', () => {
	it.each([
		[pageKey('sara-registry', DOC, 12), true],
		[documentKey('sara-registry', DOC), true],
		[pageKey('sara-registry', DOC, 0), false],
		[pageKey('sara-registry', DOC, '1234567'), false],
		[pageKey('..', DOC, 1), false],
		[pageKey('a/b', DOC, 1), false],
		[pageKey('sara', DOC.toUpperCase(), 1), false],
		[documentKey('sara', 'not-a-uuid'), false]
	])('%s → %s', (key, ok) => {
		expect(isValidKey(key)).toBe(ok);
	});
});
