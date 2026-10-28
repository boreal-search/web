import { describe, expect, it } from 'vitest';
import { count, humanise, plural, stamp } from './format.js';

describe('format', () => {
	it('pluralizes', () => {
		expect(plural(1, 'page')).toBe('page');
		expect(plural(3, 'page')).toBe('pages');
		expect(plural(0, 'page')).toBe('pages');
		expect(plural(2, 'PDF', 'PDFs')).toBe('PDFs');
	});
	it('groups thousands', () => {
		expect(count(12_345)).toBe('12,345');
		expect(count(7)).toBe('7');
	});
	it('turns identifiers into words', () => {
		expect(humanise('active')).toBe('Active');
		expect(humanise('in_progress')).toBe('In progress');
		expect(humanise('')).toBe('');
	});
	it('stamps in UTC regardless of offset', () => {
		expect(stamp('2026-10-28T00:50:12Z')).toBe('2026-10-28 00:50 UTC');
		expect(stamp('2026-10-27T20:50:12-04:00')).toBe('2026-10-28 00:50 UTC');
	});
});
