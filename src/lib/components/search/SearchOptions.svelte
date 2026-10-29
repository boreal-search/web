<!--
	What a new search covers and returns: the data sources (grouped by org, then Public, with page
	counts; every one ticked by default), the generated summary, and the results options.
-->
<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import { count } from '#lib/format.js';

	interface Group {
		label: string;
		dataSources: { id: string; name: string; pages: number | null }[];
	}

	let {
		groups,
		unpicked,
		summaryOn = $bindable(),
		topK = $bindable(),
		rerank = $bindable()
	}: {
		/** Groups that have data sources. */
		groups: readonly Group[];
		/** Unticked data source ids. */
		unpicked: SvelteSet<string>;
		summaryOn: boolean;
		topK: number;
		rerank: boolean;
	} = $props();
</script>

<div class="scope">
	{#each groups as group (group.label)}
		<fieldset>
			<legend>{group.label}</legend>
			<div class="corpora">
				{#each group.dataSources as ds (ds.id)}
					<label class="check">
						<input
							type="checkbox"
							name="data_source_ids"
							value={ds.id}
							checked={!unpicked.has(ds.id)}
							onchange={(e) =>
								e.currentTarget.checked ? unpicked.delete(ds.id) : unpicked.add(ds.id)}
						/>
						<span>
							{ds.name}
							{#if ds.pages !== null}<span class="pages">{count(ds.pages)} p.</span>{/if}
						</span>
					</label>
				{/each}
			</div>
		</fieldset>
	{:else}
		<p class="muted">No data sources are available right now.</p>
	{/each}
</div>

<div class="options">
	<label class="check">
		<input type="checkbox" name="answer" bind:checked={summaryOn} />
		Generated summary, each sentence checked
	</label>
	<details>
		<summary>Options</summary>
		<div class="option-fields">
			<label class="count">
				Results
				<input type="number" name="top_k" min="1" max="50" bind:value={topK} />
			</label>
			<label class="check">
				<input type="checkbox" name="rerank" bind:checked={rerank} />
				Rerank
			</label>
		</div>
	</details>
</div>

<style>
	.scope {
		display: grid;
		gap: 0.75rem;
	}
	.scope p {
		margin: 0;
	}
	.corpora {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.5rem;
	}
	.pages {
		margin-left: 0.25rem;
		white-space: nowrap;
		font: 400 0.8125rem/1 var(--font-mono);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
	.scope legend {
		margin-bottom: 0.125rem;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0 1.5rem;
	}
	.options details > summary {
		color: var(--color-muted);
		font-weight: 400;
	}
	.option-fields {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.5rem;
		padding: 0.25rem 0 0.5rem;
	}
	.count {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.count input {
		width: 5rem;
		min-height: 2.25rem;
		padding-block: 0.375rem;
	}
</style>
