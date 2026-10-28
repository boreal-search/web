import { describe, expect, it } from 'vitest';
import { checkFlag, isTypingTarget, locator, pagesSearched, seconds, step } from './search-view.js';

describe('checkFlag', () => {
	it('passes through not_found and not_checked', () => {
		expect(checkFlag({ state: 'not_found' })).toBe('not_found');
		expect(checkFlag({ state: 'not_checked' })).toBe('not_checked');
	});
	it('is verified only when every sentence is, unsupported when any is', () => {
		const c = (verified: number, unsupported: number, total: number) =>
			checkFlag({ state: 'checked', verified, unsupported, total });
		expect(c(2, 0, 2)).toBe('verified');
		expect(c(1, 1, 2)).toBe('unsupported');
		// Partly checked, nothing unsupported: green isn't earned.
		expect(c(1, 0, 2)).toBe('not_checked');
	});
});

describe('locator', () => {
	const r = (section: string | null, page_number = 12) => ({
		document_title: 'Species at Risk Act',
		section,
		page_number
	});
	it('is title, section and page', () => {
		expect(locator(r('Interpretation › Sections 4-7'))).toEqual([
			'Species at Risk Act',
			'Interpretation › Sections 4-7',
			'P.12'
		]);
		expect(locator(r(null, 3))).toEqual(['Species at Risk Act', 'P.3']);
	});
	it('shortens long sections from the left and never drops the page', () => {
		const long =
			'Species at Risk Act › Part 2 › Protection Measures › Interpretation › Sections 4-7';
		expect(locator(r(long), 40)).toEqual([
			'Species at Risk Act',
			'…Interpretation › Sections 4-7',
			'P.12'
		]);
	});
	it('cuts one over-long last segment at the end', () => {
		const [, section, page] = locator(r(`Part 1 › ${'Declaration; Sanction; '.repeat(4)}`), 20);
		expect(section).toBe('…Declaration; Sancti…');
		expect(page).toBe('P.12');
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
