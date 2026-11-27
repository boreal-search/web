import { describe, expect, it } from 'vitest';
import { citedDataSources, distinctNotices, noticeParts } from './notice';

const join = (parts: { text: string }[]) => parts.map((p) => p.text).join('');

describe('noticeParts', () => {
	it('keeps plain text as one part', () => {
		expect(noticeParts('Not an official version.\nSecond line.')).toEqual([
			{ kind: 'text', text: 'Not an official version.\nSecond line.' }
		]);
	});

	it('links each URL, leaving the punctuation around it as text', () => {
		const bc =
			'made available at: http://www.bclaws.gov.bc.ca and used under the Licence available at: https://www.bclaws.gov.bc.ca/standards/Licence.html . Not official.';
		const parts = noticeParts(bc);
		expect(parts.filter((p) => p.kind === 'link').map((p) => p.text)).toEqual([
			'http://www.bclaws.gov.bc.ca',
			'https://www.bclaws.gov.bc.ca/standards/Licence.html'
		]);
		expect(join(parts)).toBe(bc);
	});

	it('drops a closing bracket or full stop that ends the sentence, not the URL', () => {
		const fed =
			'Reproduced from the Justice Laws Website (https://laws-lois.justice.gc.ca). See https://x.ca/a_(b).';
		const parts = noticeParts(fed);
		expect(parts.filter((p) => p.kind === 'link').map((p) => p.text)).toEqual([
			'https://laws-lois.justice.gc.ca',
			'https://x.ca/a_(b)'
		]);
		expect(join(parts)).toBe(fed);
	});

	it('leaves a bare scheme as text', () => {
		expect(noticeParts('see https://.')).toEqual([{ kind: 'text', text: 'see https://.' }]);
	});
});

describe('citedDataSources', () => {
	it('maps each citation to its document’s data source via the results', () => {
		const results = [
			{ document_id: 'd1', data_source_id: 'cepa' },
			{ document_id: 'd2', data_source_id: 'wildlife' }
		];
		expect(
			citedDataSources(
				[{ document_id: 'd2' }, { document_id: 'd1' }, { document_id: 'gone' }],
				results
			)
		).toEqual(['wildlife', 'cepa']);
	});
});

describe('distinctNotices', () => {
	it('gives each notice once, skipping sources without one', () => {
		const notices = new Map([
			['cepa', 'Federal'],
			['iaa', 'Federal'],
			['wildlife', 'BC']
		]);
		expect(distinctNotices(['iaa', 'own', 'wildlife', 'cepa'], notices)).toEqual(['Federal', 'BC']);
	});
});
