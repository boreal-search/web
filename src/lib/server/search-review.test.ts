import { describe, expect, it } from 'vitest';
import { parseReviewQuery, reviewSearch } from './search-review';

const ORG = '10000000-0000-0000-0000-000000000001';
const parse = (s: string) => parseReviewQuery(new URLSearchParams(s));

describe('parseReviewQuery', () => {
	it('defaults to everything on page 1', () => {
		expect(parse('')).toEqual({
			q: '',
			status: null,
			rating: null,
			verdict: null,
			org: null,
			page: 1
		});
	});
	it('reads every filter', () => {
		expect(parse(`q=chinook&status=timeout&rating=bad&verdict=none&org=${ORG}&page=2`)).toEqual({
			q: 'chinook',
			status: 'timeout',
			rating: 'bad',
			verdict: 'none',
			org: { kind: 'org', id: ORG },
			page: 2
		});
	});
	it('reads the Public context', () => {
		expect(parse('org=public').org).toEqual({ kind: 'public' });
	});
	it('ignores unknown values', () => {
		expect(parse('status=lost&rating=meh&org=acme')).toMatchObject({
			status: null,
			rating: null,
			org: null
		});
	});
});

describe('reviewSearch', () => {
	it('round-trips a view, leaving out page 1 and unset filters', () => {
		const q = parse('q=chinook&rating=bad&org=public&page=1');
		expect(reviewSearch(q)).toBe('?q=chinook&rating=bad&org=public');
		expect(parse(reviewSearch(q, 3).slice(1))).toEqual({ ...q, page: 3 });
	});
	it('is empty for the unfiltered first page', () => {
		expect(reviewSearch(parse(''))).toBe('');
	});
});
