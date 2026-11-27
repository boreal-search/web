<!--
	One data source in the picker: its tick, name and page count, and, when it has one, a
	"Notice" toggle that shows its notice under the row.
-->
<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import SourceNotice from '#lib/components/SourceNotice.svelte';
	import { count } from '#lib/format.js';
	import type { PickerDataSource } from '#lib/picker.js';

	let {
		ds,
		unpicked,
		notice
	}: {
		ds: PickerDataSource;
		/** Unticked data source ids. */
		unpicked: SvelteSet<string>;
		notice: string | undefined;
	} = $props();

	let open = $state(false);
	const noticeId = $props.id();
</script>

<li>
	<label class="check">
		<input
			type="checkbox"
			checked={!unpicked.has(ds.id)}
			onchange={(e) => (e.currentTarget.checked ? unpicked.delete(ds.id) : unpicked.add(ds.id))}
		/>
		<span class="name">{ds.name}</span>
		{#if ds.pages !== null}<span class="pages">{count(ds.pages)} p.</span>{/if}
	</label>
	{#if notice}
		<button
			type="button"
			class="quiet toggle"
			aria-expanded={open}
			aria-controls={noticeId}
			aria-label="Notice for {ds.name}"
			onclick={() => (open = !open)}>Notice</button
		>
		<div class="notice" id={noticeId} hidden={!open}><SourceNotice text={notice} /></div>
	{/if}
</li>

<style>
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: baseline;
		column-gap: 0.75rem;
	}
	.check {
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
	.toggle {
		min-height: 1.75rem;
		padding-inline: 0;
		font: 400 0.8125rem/1 var(--font-mono);
		color: var(--color-muted);
	}
	.toggle[aria-expanded='true'] {
		color: var(--color-ink);
	}
	.notice {
		grid-column: 1 / -1;
		padding: 0 0 0.5rem 1.625rem;
	}
	.notice[hidden] {
		display: none;
	}
</style>
