// The search page's data source picker: grouped like `Access.groups` ("<Org name>", "Public"),
// and within each, under the engine's headings (`DataSource.group`).

export interface PickerDataSource {
	id: string;
	name: string;
	/** The engine's heading for it (a label only); null: none, listed under "Other". */
	group: string | null;
	/** null until the engine's listing arrives, or when it failed (ids stand in for names). */
	pages: number | null;
	documents: number | null;
	indexed_at: string | null;
}

export interface PickerGroup {
	label: string;
	dataSources: PickerDataSource[];
}

export const OTHER = 'Other';

/** The picker from access alone: ids stand in for names until (unless) the engine's listing arrives. */
export const idPicker = (
	groups: readonly { label: string; ids: readonly string[] }[]
): PickerGroup[] =>
	groups.map((g) => ({
		label: g.label,
		dataSources: g.ids.map((id) => ({
			id,
			name: id,
			group: null,
			pages: null,
			documents: null,
			indexed_at: null
		}))
	}));

/**
 * Data sources under their headings, alphabetical with "Other" (no heading) last, each keeping
 * the order it was given in. null when none has a heading: the picker stays a flat list.
 */
export function pickerHeadings(dataSources: readonly PickerDataSource[]): PickerGroup[] | null {
	if (dataSources.every((ds) => ds.group === null)) return null;
	const byLabel = new Map<string, PickerDataSource[]>();
	for (const ds of dataSources) {
		const label = ds.group ?? OTHER;
		byLabel.set(label, [...(byLabel.get(label) ?? []), ds]);
	}
	return [...byLabel]
		.map(([label, list]) => ({ label, dataSources: list }))
		.sort(
			(a, b) =>
				Number(a.label === OTHER) - Number(b.label === OTHER) || a.label.localeCompare(b.label)
		);
}

/** How many of `ids` are ticked, for a heading's tri-state checkbox. */
export function ticked(
	ids: readonly string[],
	unpicked: ReadonlySet<string>
): 'all' | 'some' | 'none' {
	const on = ids.filter((id) => !unpicked.has(id)).length;
	return on === 0 ? 'none' : on === ids.length ? 'all' : 'some';
}
