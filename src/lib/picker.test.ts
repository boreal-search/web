import { describe, expect, it } from 'vitest';
import { idPicker, pickerHeadings, ticked, type PickerDataSource } from './picker';

const ds = (id: string, group: string | null): PickerDataSource => ({
	id,
	name: id,
	group,
	pages: null,
	documents: null,
	indexed_at: null
});

describe('idPicker', () => {
	it('names each data source by its id, with no heading or counts', () => {
		expect(idPicker([{ label: 'Acme', ids: ['a'] }])).toEqual([
			{ label: 'Acme', dataSources: [ds('a', null)] }
		]);
	});
});

describe('pickerHeadings', () => {
	it('is null when no data source has a heading (a flat list)', () => {
		expect(pickerHeadings([ds('a', null), ds('b', null)])).toBeNull();
		expect(pickerHeadings([])).toBeNull();
	});

	it('lists headings alphabetically, keeping each one’s order, with Other last', () => {
		const list = [
			ds('cepa', 'Federal environmental law'),
			ds('mine', null),
			ds('wildlife', 'BC environmental law'),
			ds('iaa', 'Federal environmental law')
		];
		expect(pickerHeadings(list)).toEqual([
			{ label: 'BC environmental law', dataSources: [list[2]] },
			{ label: 'Federal environmental law', dataSources: [list[0], list[3]] },
			{ label: 'Other', dataSources: [list[1]] }
		]);
	});
});

describe('ticked', () => {
	it('reads all, some or none of the ids as ticked', () => {
		expect(ticked(['a', 'b'], new Set())).toBe('all');
		expect(ticked(['a', 'b'], new Set(['a']))).toBe('some');
		expect(ticked(['a', 'b'], new Set(['a', 'b', 'c']))).toBe('none');
	});
});
