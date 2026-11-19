// The search page's data source picker: grouped like `Access.groups` ("<Org name>", "Public").

export interface PickerDataSource {
	id: string;
	name: string;
	/** null until the engine's listing arrives, or when it failed (ids stand in for names). */
	pages: number | null;
	documents: number | null;
	indexed_at: string | null;
}

export interface PickerGroup {
	label: string;
	dataSources: PickerDataSource[];
}

/** The picker from access alone: ids stand in for names until (unless) the engine's listing arrives. */
export const idPicker = (
	groups: readonly { label: string; ids: readonly string[] }[]
): PickerGroup[] =>
	groups.map((g) => ({
		label: g.label,
		dataSources: g.ids.map((id) => ({
			id,
			name: id,
			pages: null,
			documents: null,
			indexed_at: null
		}))
	}));
