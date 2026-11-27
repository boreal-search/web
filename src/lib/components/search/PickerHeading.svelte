<!--
	One engine heading in the picker ("Federal environmental law"): a checkbox that ticks every data
	source under it (mixed when some are), and the heading itself, which shows or hides them.
	Starts collapsed; the count says how many are ticked.
-->
<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import { ticked, type PickerGroup } from '#lib/picker.js';
	import PickerItem from './PickerItem.svelte';

	let {
		heading,
		unpicked,
		notices
	}: {
		heading: PickerGroup;
		/** Unticked data source ids. */
		unpicked: SvelteSet<string>;
		notices: ReadonlyMap<string, string>;
	} = $props();

	let open = $state(false);
	const listId = $props.id();
	let ids = $derived(heading.dataSources.map((ds) => ds.id));
	let tick = $derived(ticked(ids, unpicked));
	let on = $derived(ids.filter((id) => !unpicked.has(id)).length);

	function tickAll(checked: boolean) {
		for (const id of ids) {
			if (checked) unpicked.delete(id);
			else unpicked.add(id);
		}
	}
</script>

<li>
	<div class="head">
		<input
			type="checkbox"
			aria-label="All of {heading.label}"
			checked={tick === 'all'}
			indeterminate={tick === 'some'}
			onchange={(e) => tickAll(e.currentTarget.checked)}
		/>
		<button
			type="button"
			class="disclose"
			aria-expanded={open}
			aria-controls={listId}
			onclick={() => (open = !open)}
		>
			<span class="caret" aria-hidden="true">▸</span>
			<span class="label">{heading.label}</span>
			<span class="count">{on}/{ids.length}<span class="sr-only"> ticked</span></span>
		</button>
	</div>
	<ul id={listId} hidden={!open}>
		{#each heading.dataSources as ds (ds.id)}
			<PickerItem {ds} {unpicked} notice={notices.get(ds.id)} />
		{/each}
	</ul>
</li>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.head input {
		flex: none;
	}
	.disclose {
		flex: 1;
		justify-content: flex-start;
		gap: 0.375rem;
		min-width: 0;
		min-height: 2.25rem;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		white-space: normal;
	}
	.caret {
		flex: none;
		width: 1ch;
		color: var(--color-muted);
	}
	.disclose[aria-expanded='true'] .caret {
		rotate: 90deg;
	}
	.label {
		flex: 1;
		min-width: 0;
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.count {
		white-space: nowrap;
		font: 400 0.8125rem/1 var(--font-mono);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
	ul {
		margin: 0 0 0.25rem;
		padding: 0 0 0 1.625rem;
		list-style: none;
	}
	ul[hidden] {
		display: none;
	}
</style>
