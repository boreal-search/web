<!--
	Search options, one control at the composer. Collapsed it reads as a summary ("All 3 data
	sources · summary on"); open it is a popover at the composer (a non-modal <dialog>) on
	desktop and a full-screen modal (`showModal()`) on phones. Sections: Data sources
	(DataSourcePicker), Generated summary, Results, and, once there is a trail, "Search exactly as typed" for follow-ups. Escape, Close
	or a click outside closes it (focus returns to the control); the page closes it when the
	composer is focused or typed in, and on search.
-->
<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import { optionsSummary } from '#lib/search-options.js';
	import { topKValue } from '#lib/search-view.js';
	import DataSourcePicker, { type Group } from './DataSourcePicker.svelte';

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
		<span class="caret" aria-hidden="true">▴</span>
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

		<DataSourcePicker {groups} {unpicked} />

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
	/* Points the way the popover opens (down by default; `--options-caret: 0deg` for up), and
	   back once open. */
	.caret {
		display: inline-block;
		rotate: var(--options-caret, 180deg);
	}
	.trigger[aria-expanded='true'] .caret {
		rotate: calc(var(--options-caret, 180deg) + 180deg);
	}
	/* Desktop: a popover over the page, anchored to the composer (its positioned ancestor): below
	   it by default, above it where the composer is pinned (`--options-top/-bottom`). */
	dialog {
		position: absolute;
		inset: var(--options-top, calc(100% + 0.25rem)) auto var(--options-bottom, auto) 0;
		z-index: 3;
		width: min(34rem, 100%);
		max-height: min(45dvh, 30rem);
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
