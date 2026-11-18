import { describe, expect, it } from 'vitest';
import { DEFAULT_SORT, parseReviewQuery, reviewSearch, sortBy } from './search-review';

const ORG = '10000000-0000-0000-0000-000000000001';
const parse = (s: string) => parseReviewQuery(new URLSearchParams(s));

describe('parseReviewQuery', () => {
	it('defaults to everything, newest first, on page 1', () => {
		expect(parse('')).toEqual({
			q: '',
			user: '',
			org: null,
			source: null,
			status: null,
			rating: null,
			from: null,
			to: null,
			minSeconds: null,
			maxSeconds: null,
			sort: DEFAULT_SORT,
			page: 1
		});
	});
	it('reads every filter and the sort', () => {
		expect(
			parse(
				`q=chinook&user=%20Owner@&org=${ORG}&source=acme-docs&status=timeout&rating=rated` +
					'&from=2026-11-01&to=2026-11-18&min_s=1.5&max_s=30&sort=user&dir=desc&page=2'
			)
		).toEqual({
			q: 'chinook',
			user: 'Owner@',
			org: { kind: 'org', id: ORG },
			source: 'acme-docs',
			status: 'timeout',
			rating: 'rated',
			from: '2026-11-01',
			to: '2026-11-18',
			minSeconds: 1.5,
			maxSeconds: 30,
			sort: { key: 'user', dir: 'desc' },
			page: 2
		});
	});
	it('reads the Public context', () => {
		expect(parse('org=public').org).toEqual({ kind: 'public' });
	});
	it('starts a column at its first direction', () => {
		expect(parse('sort=taken').sort).toEqual({ key: 'taken', dir: 'desc' });
		expect(parse('sort=query').sort).toEqual({ key: 'query', dir: 'asc' });
	});
	it('ignores unknown or malformed values', () => {
		expect(
			parse(
				'status=lost&rating=meh&org=acme&source=a,b&from=2026-13-40&to=yesterday' +
					'&min_s=-1&max_s=1e9&sort=score&dir=up'
			)
		).toMatchObject({
			status: null,
			rating: null,
			org: null,
			source: null,
			from: null,
			to: null,
			minSeconds: null,
			maxSeconds: null,
			sort: DEFAULT_SORT
		});
	});
});

describe('reviewSearch', () => {
	it('round-trips a view, leaving out page 1, defaults and unset filters', () => {
		const q = parse('q=chinook&rating=bad&org=public&min_s=2&sort=taken&page=1');
		expect(reviewSearch(q)).toBe('?q=chinook&org=public&rating=bad&min_s=2&sort=taken');
		expect(parse(reviewSearch(q, 3).slice(1))).toEqual({ ...q, page: 3 });
	});
	it('keeps a direction only when it is not the column’s first', () => {
		expect(reviewSearch(parse('sort=query&dir=desc'))).toBe('?sort=query&dir=desc');
		expect(reviewSearch(parse('sort=time&dir=asc'))).toBe('?sort=time&dir=asc');
	});
	it('is empty for the unfiltered first page, newest first', () => {
		expect(reviewSearch(parse(''))).toBe('');
	});
	it('re-sorts back on page 1', () => {
		expect(reviewSearch(parse('page=4'), 1, { key: 'user', dir: 'asc' })).toBe('?sort=user');
	});
});

describe('sortBy', () => {
	it('flips the current column and starts another at its first direction', () => {
		expect(sortBy(DEFAULT_SORT, 'time')).toEqual({ key: 'time', dir: 'asc' });
		expect(sortBy({ key: 'user', dir: 'asc' }, 'user')).toEqual({ key: 'user', dir: 'desc' });
		expect(sortBy(DEFAULT_SORT, 'rating')).toEqual({ key: 'rating', dir: 'asc' });
		expect(sortBy(DEFAULT_SORT, 'taken')).toEqual({ key: 'taken', dir: 'desc' });
	});
});
