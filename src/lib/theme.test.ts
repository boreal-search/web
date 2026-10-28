import { describe, expect, it } from 'vitest';
import { parseTheme } from './theme.js';

describe('parseTheme', () => {
	it('keeps known themes', () => {
		expect(parseTheme('light')).toBe('light');
		expect(parseTheme('dark')).toBe('dark');
		expect(parseTheme('system')).toBe('system');
	});
	it('falls back to system for anything else', () => {
		expect(parseTheme(undefined)).toBe('system');
		expect(parseTheme(null)).toBe('system');
		expect(parseTheme('')).toBe('system');
		expect(parseTheme('Dark')).toBe('system');
		expect(parseTheme('" onload="x')).toBe('system');
	});
});
