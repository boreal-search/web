<!--
	Search options, one control at the composer. Collapsed it reads as a summary ("All 3 data
	sources · summary on"); open it is a popover above the composer (a non-modal <dialog>) on
	desktop and a full-screen modal (`showModal()`) on phones. Sections: Data sources (grouped by
	org, then Public, one per line with page counts, all/none per group), Generated summary,
	Results, and, once there is a trail, "Search exactly as typed" for follow-ups. Escape, Close
	or a click outside closes it (focus returns to the control); the page closes it when the
	composer is focused or typed in, and on search.
-->
<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import { count } from '#lib/format.js';
	import { optionsSummary } from '#lib/search-options.js';
	import { topKValue } from '#lib/search-view.js';

	interface Group {
		label: string;
		dataSources: { id: string; name: string; pages: number | null }[];
	}

	let {
		groups,
		unpicked,
		summaryOn = $bindable(),
		topK = $bindable(),
		rerank = $bindable(),
		exact = $bindable(),
		followUp,
		open = $bindable(false)
	}: {
		/** Groups that have data sources. */
		groups: readonly Group[];
		/** Unticked data source ids. */
		unpicked: SvelteSet<string>;
		summaryOn: boolean;
		topK: number;
		rerank: boolean;
		/** "Search exactly as typed" (follow-ups only). */
		exact: boolean;
		/** The composer continues a trail: offer "Search exactly as typed". */
		followUp: boolean;
		open?: boolean;
	} = $props();

	const PHONE = '(max-width: 760px)';
	let dialog = $state<HTMLDialogElement>();
	let trigger = $state<HTMLButtonElement>();
	let wrap = $state<HTMLDivElement>();

	let ids = $derived(groups.flatMap((g) => g.dataSources.map((ds) => ds.id)));
	let summary = $derived(
		optionsSummary({
			picked: ids.filter((id) => !unpicked.has(id)).length,
			total: ids.length,
			summaryOn,
			topK: topKValue(topK),
			rerank,
			exact: followUp && exact
		})
	);

	// Keep the <dialog> in step with `open` (the page closes it from the composer).
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			if (matchMedia(PHONE).matches) dialog.showModal();
			else dialog.show();
		} else if (!open && dialog.open) dialog.close();
	});

	function close() {
		open = false;
		trigger?.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
			e.preventDefault(); // not a search: Enter in an option only sets it
		}
	}

	function setGroup(group: Group, on: boolean) {
		for (const ds of group.dataSources) {
			if (on) unpicked.delete(ds.id);
			else unpicked.add(ds.id);
		}
	}
</script>

<svelte:document
	onpointerdown={(e) => {
		if (open && dialog && !dialog.matches(':modal') && !wrap?.contains(e.target as Node))
			open = false;
	}}
/>

<div class="options" bind:this={wrap}>
	<button
		type="button"
		class="quiet trigger"
		bind:this={trigger}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-controls="search-options"
		onclick={() => (open = !open)}
	>
		<span class="sr-only">Search options:</span>
		<span>{summary}</span>
		<span class="caret" aria-hidden="true">{open ? '▾' : '▴'}</span>
	</button>

	<dialog
		id="search-options"
		aria-labelledby="search-options-title"
		bind:this={dialog}
		onclose={() => (open = false)}
		{onkeydown}
	>
		<header>
			<h2 id="search-options-title">Search options</h2>
			<button type="button" class="quiet" onclick={close}>Close</button>
		</header>

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

		<section aria-labelledby="opt-summary">
			<h3 id="opt-summary">Generated summary</h3>
			<label class="check">
				<input type="checkbox" bind:checked={summaryOn} />
				Generated summary · each sentence checked
			</label>
		</section>

		<section aria-labelledby="opt-results">
			<h3 id="opt-results">Results</h3>
			<div class="row">
				<label class="count">
					Results
					<input type="number" min="1" max="50" bind:value={topK} />
				</label>
				<label class="check">
					<input type="checkbox" bind:checked={rerank} />
					Rerank
				</label>
			</div>
			{#if followUp}
				<label class="check">
					<input type="checkbox" bind:checked={exact} />
					Search follow-ups exactly as typed
				</label>
			{/if}
		</section>
	</dialog>
</div>

<style>
	.trigger {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		min-height: 2rem;
		padding-inline: 0;
		font: 400 0.8125rem/1.4 var(--font-mono);
		color: var(--color-muted);
		text-align: left;
		white-space: normal;
	}
	/* Desktop: a popover above the composer (the composer is the positioned ancestor). */
	dialog {
		position: absolute;
		inset: auto auto calc(100% + 0.25rem) 0;
		width: min(34rem, 100%);
		max-height: min(70vh, 40rem);
		margin: 0;
		padding: 0 1rem 1rem;
		overflow: auto;
		border: 1px solid var(--color-rule);
		border-radius: 4px;
		background: var(--color-surface);
		color: var(--color-ink);
	}
	/* Phones: a full-screen sheet. */
	dialog:modal {
		position: fixed;
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		border: 0;
		border-radius: 0;
		background: var(--color-page);
	}
	header {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0 0.5rem;
		border-bottom: 1px solid var(--color-rule);
		background: inherit;
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
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
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.5rem;
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
