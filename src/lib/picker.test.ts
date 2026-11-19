import { describe, expect, it } from 'vitest';
import { idPicker } from './picker';

describe('idPicker', () => {
	it('names each data source by its id, with no counts', () => {
		expect(idPicker([{ label: 'Acme', ids: ['a'] }])).toEqual([
			{
				label: 'Acme',
				dataSources: [{ id: 'a', name: 'a', pages: null, documents: null, indexed_at: null }]
			}
		]);
	});
});
