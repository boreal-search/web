import { describe, expect, it } from 'vitest';
import { containsFilter, escapeLike, pageRange, pageWindow, parseUsersQuery } from './users';

const parse = (s: string) => parseUsersQuery(new URLSearchParams(s));

describe('parseUsersQuery', () => {
	it('defaults to no search, page 1', () => {
		expect(parse('')).toEqual({ q: '', page: 1 });
	});
	it('trims and collapses spaces in q', () => {
		expect(parse('q=%20%20Jane%20%20Doe%20')).toEqual({ q: 'Jane Doe', page: 1 });
	});
	it('caps q at 200 characters', () => {
		expect(parse(`q=${'a'.repeat(300)}`).q).toHaveLength(200);
	});
	it('reads a page number', () => {
		expect(parse('page=3').page).toBe(3);
	});
	it.each(['0', '-2', 'abc', '2.5', '1e3', ''])('treats page=%j as page 1', (p) => {
		expect(parse(`page=${p}`).page).toBe(1);
	});
	it('caps huge pages', () => {
		expect(parse('page=99999999999').page).toBe(100_000);
	});
});

describe('pageRange', () => {
	it('is 0-based and inclusive', () => {
		expect(pageRange(1)).toEqual({ from: 0, to: 49 });
		expect(pageRange(2)).toEqual({ from: 50, to: 99 });
	});
});

describe('pageWindow', () => {
	it('shows a full middle page', () => {
		expect(pageWindow(2, 1234)).toEqual({
			first: 51,
			last: 100,
			pageCount: 25,
			outOfRange: false,
			hasPrevious: true,
			hasNext: true
		});
	});
	it('shows a short last page', () => {
		expect(pageWindow(25, 1234)).toMatchObject({ first: 1201, last: 1234, hasNext: false });
	});
	it('fits one page', () => {
		expect(pageWindow(1, 3)).toMatchObject({
			first: 1,
			last: 3,
			pageCount: 1,
			hasPrevious: false,
			hasNext: false
		});
	});
	it('marks a page past the end as out of range, with no previous link', () => {
		expect(pageWindow(30, 1234)).toMatchObject({
			first: 0,
			last: 0,
			outOfRange: true,
			hasPrevious: false,
			hasNext: false
		});
	});
	it('is empty, not out of range, when there are no rows', () => {
		expect(pageWindow(1, 0)).toMatchObject({ first: 0, last: 0, pageCount: 0, outOfRange: false });
		expect(pageWindow(4, 0).outOfRange).toBe(false);
	});
	it('handles an exact multiple of the page size', () => {
		expect(pageWindow(2, 100)).toMatchObject({ first: 51, last: 100, hasNext: false });
		expect(pageWindow(3, 100).outOfRange).toBe(true);
	});
});

describe('escapeLike', () => {
	it('escapes LIKE wildcards and the escape character', () => {
		expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
	});
	it('leaves other text alone', () => {
		expect(escapeLike('jane.doe@acme.com')).toBe('jane.doe@acme.com');
	});
});

describe('containsFilter', () => {
	it('quotes the pattern for every column', () => {
		expect(containsFilter(['email', 'display_name'], 'acme.com')).toBe(
			'email.ilike."%acme.com%",display_name.ilike."%acme.com%"'
		);
	});
	it('keeps commas and parentheses inside the quotes', () => {
		expect(containsFilter(['email'], 'Doe, Jane (EA)')).toBe('email.ilike."%Doe, Jane (EA)%"');
	});
	it('escapes wildcards once for LIKE, then backslashes and quotes again for PostgREST', () => {
		// LIKE pattern %a\_b%; PostgREST unquotes \\ to \.
		expect(containsFilter(['email'], 'a_b')).toBe('email.ilike."%a\\\\_b%"');
		expect(containsFilter(['email'], 'say "hi"')).toBe('email.ilike."%say \\"hi\\"%"');
	});
});
