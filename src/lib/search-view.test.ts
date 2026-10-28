import { describe, expect, it } from 'vitest';
import { checkFlag, isTypingTarget, pagesSearched, seconds, step } from './search-view.js';

describe('checkFlag', () => {
	it('passes through not_found and not_checked', () => {
		expect(checkFlag({ state: 'not_found' })).toBe('not_found');
		expect(checkFlag({ state: 'not_checked' })).toBe('not_checked');
	});
	it('is verified only when every claim is', () => {
		const v = { text: 'a', state: 'verified', ref: 1 } as const;
		const u = { text: 'b', state: 'unsupported', ref: 2 } as const;
		expect(checkFlag({ state: 'checked', claims: [v, v] })).toBe('verified');
		expect(checkFlag({ state: 'checked', claims: [v, u] })).toBe('unsupported');
	});
});

describe('readout formatting', () => {
	it('shows seconds with one decimal', () => {
		expect(seconds(746)).toBe('0.7');
		expect(seconds(12_340)).toBe('12.3');
		expect(seconds(-5)).toBe('0.0');
	});
	it('sums page counts, or null when one is unknown', () => {
		expect(pagesSearched([314, 125, 115])).toBe(554);
		expect(pagesSearched([314, null])).toBeNull();
		expect(pagesSearched([])).toBe(0);
	});
});

describe('keyboard', () => {
	it('treats form controls and editable elements as typing targets', () => {
		expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
		expect(isTypingTarget({ tagName: 'textarea' } as unknown as EventTarget)).toBe(true);
		expect(
			isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)
		).toBe(true);
		expect(isTypingTarget({ tagName: 'A' } as unknown as EventTarget)).toBe(false);
		expect(isTypingTarget(null)).toBe(false);
	});
	it('steps within bounds', () => {
		expect(step(0, 1, 3)).toBe(1);
		expect(step(2, 1, 3)).toBe(2);
		expect(step(0, -1, 3)).toBe(0);
		expect(step(0, 1, 0)).toBe(0);
	});
});
