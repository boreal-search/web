<!--
	Search options' Data sources: grouped by org, then Public, one per line with page counts,
	All / None per group. Ticks write straight into `unpicked`.
-->
<script module lang="ts">
	export interface Group {
		label: string;
		dataSources: { id: string; name: string; pages: number | null }[];
	}
</script>

<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import { count } from '#lib/format.js';

	let {
		groups,
		unpicked
	}: {
		/** Groups that have data sources. */
		groups: readonly Group[];
		/** Unticked data source ids. */
		unpicked: SvelteSet<string>;
	} = $props();

	function setGroup(group: Group, on: boolean) {
		for (const ds of group.dataSources) {
			if (on) unpicked.delete(ds.id);
			else unpicked.add(ds.id);
		}
	}
</script>

<section aria-labelledby="opt-sources">
	<h3 id="opt-sources">Data sources</h3>
	{#each groups as group (group.label)}
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
				{#each group.dataSources as ds (ds.id)}
					<li>
						<label class="check">
							<input
								type="checkbox"
								checked={!unpicked.has(ds.id)}
								onchange={(e) =>
									e.currentTarget.checked ? unpicked.delete(ds.id) : unpicked.add(ds.id)}
							/>
							<span class="name">{ds.name}</span>
							{#if ds.pages !== null}<span class="pages">{count(ds.pages)} p.</span>{/if}
						</label>
					</li>
				{/each}
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
	ul .check {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.pages {
		white-space: nowrap;
		font: 400 0.8125rem/1 var(--font-mono);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
