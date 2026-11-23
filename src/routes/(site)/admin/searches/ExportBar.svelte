<!-- The table's JSON exports: the whole view (GET, same params), or the searches picked in the
     table (a plain form POST, so the browser downloads the file and the page stays). The pick
     lives in `selected` and survives paging and re-filtering. -->
<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { count, plural } from '#lib/format.js';

	let {
		selected,
		pageIds,
		view,
		total,
		exportMax,
		selectedMax
	}: {
		selected: SvelteSet<string>;
		/** The searches on this page that can be picked. */
		pageIds: string[];
		/** `?…` of this view. */
		view: string;
		total: number;
		exportMax: number;
		selectedMax: number;
	} = $props();

	const exportHref = resolve('/(site)/admin/searches/export');
	let allPicked = $derived(pageIds.every((id) => selected.has(id)));
	let tooMany = $derived(selected.size > selectedMax);
</script>

<div class="export">
	<p>
		<a class="button" href="{exportHref}{view}" download>Download JSON</a>
		<span class="muted"
			>{total > exportMax
				? `The first ${count(exportMax)} of ${count(total)} matching searches, in this order.`
				: `All ${count(total)} matching ${plural(total, 'search', 'searches')}, in this order.`}</span
		>
	</p>
	<form method="post" action={exportHref}>
		<button
			type="button"
			class="quiet"
			disabled={allPicked}
			onclick={() => pageIds.forEach((id) => selected.add(id))}>Select all on this page</button
		>
		<button
			type="button"
			class="quiet"
			disabled={selected.size === 0}
			onclick={() => selected.clear()}>Deselect all</button
		>
		{#each selected as id (id)}<input type="hidden" name="id" value={id} />{/each}
		<button type="submit" disabled={selected.size === 0 || tooMany}
			>Download <span class="mono">{count(selected.size)}</span> selected</button
		>
		{#if tooMany}<span class="muted">At most {count(selectedMax)} at once.</span>{/if}
	</form>
</div>

<style>
	.export {
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}
	p,
	form {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 1rem;
		margin: 0 0 0.5rem;
	}
	.mono {
		font-family: var(--font-mono);
	}
</style>
