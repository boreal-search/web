import { describe, expect, it } from 'vitest';
import { parseRatingRequest } from './ratings';

const ID = '30000000-0000-0000-0000-000000000001';
const search = { kind: 'search', id: ID } as const;

describe('parseRatingRequest', () => {
	it('reads a rating of a search, with a trimmed note', () => {
		expect(parseRatingRequest({ target: search, rating: 'bad', note: '  wrong page ' })).toEqual({
			target: search,
			value: { rating: 'bad', note: 'wrong page' }
		});
	});
	it('reads a rating of a trail; a blank note is none', () => {
		expect(
			parseRatingRequest({ target: { kind: 'trail', id: ID }, rating: 'good', note: ' ' })
		).toEqual({ target: { kind: 'trail', id: ID }, value: { rating: 'good', note: null } });
	});
	it('reads a null rating as clearing it', () => {
		expect(parseRatingRequest({ target: search, rating: null })?.value).toBeNull();
	});
	it('caps the note', () => {
		const out = parseRatingRequest({ target: search, rating: 'good', note: 'x'.repeat(2000) });
		expect(out?.value?.note).toHaveLength(1000);
	});
	it.each([
		null,
		{},
		{ target: { kind: 'search', id: 'nope' }, rating: 'good' },
		{ target: { kind: 'org', id: ID }, rating: 'good' },
		{ target: search, rating: 'meh' },
		{ target: search }
	])('refuses %j', (body) => {
		expect(parseRatingRequest(body)).toBeNull();
	});
});
