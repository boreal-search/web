import { describe, expect, it } from 'vitest';
import { DEFAULT_SPLIT, parseSidebar, parseSplit } from './layout-prefs.js';

describe('parseSidebar', () => {
	it('keeps an explicit choice and treats anything else as unset', () => {
		expect(parseSidebar('open')).toBe('open');
		expect(parseSidebar('collapsed')).toBe('collapsed');
		expect(parseSidebar(undefined)).toBeNull();
		expect(parseSidebar('yes')).toBeNull();
	});
});

describe('parseSplit', () => {
	it('reads a remembered share, rounded to a tenth', () => {
		expect(parseSplit('33.333')).toBe(33.3);
		expect(parseSplit('60')).toBe(60);
	});
	it('falls back to the default when missing, junk or out of range', () => {
		for (const v of [undefined, '', 'wide', 'NaN', '5', '90', 'Infinity'])
			expect(parseSplit(v)).toBe(DEFAULT_SPLIT);
	});
});
