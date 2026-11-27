<!--
	Search options' Data sources: grouped by org, then Public, with All / None per group. Within a
	group, data sources sit under the engine's headings (PickerHeading, collapsible), or one per
	line when none has a heading. Ticks write straight into `unpicked`.
-->
<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import { pickerHeadings, type PickerGroup } from '#lib/picker.js';
	import PickerHeading from './PickerHeading.svelte';
	import PickerItem from './PickerItem.svelte';

	let {
		groups,
		unpicked,
		notices
	}: {
		/** Groups that have data sources. */
		groups: readonly PickerGroup[];
		/** Unticked data source ids. */
		unpicked: SvelteSet<string>;
		/** Data source id → its notice. */
		notices: ReadonlyMap<string, string>;
	} = $props();

	function setGroup(group: PickerGroup, on: boolean) {
		for (const ds of group.dataSources) {
			if (on) unpicked.delete(ds.id);
			else unpicked.add(ds.id);
		}
	}
</script>

<section aria-labelledby="opt-sources">
	<h3 id="opt-sources">Data sources</h3>
	{#each groups as group (group.label)}
		{@const headings = pickerHeadings(group.dataSources)}
		<fieldset>
			<legend>{group.label}</legend>
			<p class="all">
				<button
					type="button"
					class="quiet"
					aria-label="Select all in {group.label}"
					onclick={() => setGroup(group, true)}>All</button
				>
				<button
					type="button"
					class="quiet"
					aria-label="Select none in {group.label}"
					onclick={() => setGroup(group, false)}>None</button
				>
			</p>
			<ul>
				{#if headings}
					{#each headings as heading (heading.label)}
						<PickerHeading {heading} {unpicked} {notices} />
					{/each}
				{:else}
					{#each group.dataSources as ds (ds.id)}
						<PickerItem {ds} {unpicked} notice={notices.get(ds.id)} />
					{/each}
				{/if}
			</ul>
		</fieldset>
	{:else}
		<p class="muted">No data sources are available right now.</p>
	{/each}
</section>

<style>
	h3 {
		margin: 0.75rem 0 0.25rem;
		font-size: 0.875rem;
		font-weight: 600;
	}
	fieldset {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: baseline;
		margin: 0 0 0.5rem;
		padding: 0;
		border: 0;
	}
	legend {
		float: left;
		padding: 0;
		color: var(--color-muted);
		font-size: 0.875rem;
	}
	.all {
		display: flex;
		gap: 0.75rem;
		margin: 0;
	}
	.all button {
		min-height: 1.75rem;
		padding-inline: 0;
		font-size: 0.8125rem;
	}
	ul {
		grid-column: 1 / -1;
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
