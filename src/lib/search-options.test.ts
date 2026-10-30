import { describe, expect, it } from 'vitest';
import { optionsSummary, type SearchSettings } from './search-options.js';

const base: SearchSettings = {
	picked: 3,
	total: 3,
	summaryOn: true,
	topK: 10,
	rerank: true,
	exact: false
};

describe('optionsSummary', () => {
	it('reads as sources and summary by default', () => {
		expect(optionsSummary(base)).toBe('All 3 data sources · summary on');
		expect(optionsSummary({ ...base, picked: 1, summaryOn: false })).toBe(
			'1 data source · summary off'
		);
		expect(optionsSummary({ ...base, picked: 0 })).toBe('No data sources · summary on');
	});

	it('adds only what differs from the default', () => {
		expect(optionsSummary({ ...base, picked: 2, topK: 20, rerank: false, exact: true })).toBe(
			'2 data sources · summary on · 20 results · no rerank · exactly as typed'
		);
	});
});
