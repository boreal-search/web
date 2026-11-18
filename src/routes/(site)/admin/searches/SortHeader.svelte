<!-- A column header that sorts the table: a link to the view sorted by it (again: flipped). -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Sort, SortKey } from '#lib/server/search-review.js';

	let {
		key,
		label,
		sort,
		search,
		num = false
	}: {
		key: SortKey;
		label: string;
		sort: Sort;
		/** `?…` for the table sorted by this column. */
		search: string;
		num?: boolean;
	} = $props();

	const here = resolve('/(site)/admin/searches');

	let active = $derived(sort.key === key);
	let ariaSort = $derived(
		active
			? sort.dir === 'asc'
				? ('ascending' as const)
				: ('descending' as const)
			: ('none' as const)
	);
</script>

<th scope="col" class:num aria-sort={ariaSort}>
	<a href="{here}{search}" class:active data-sveltekit-reset="false"
		>{label}<span class="arrow" aria-hidden="true"
			>{active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span
		></a
	>
</th>

<style>
	a {
		color: inherit;
		text-decoration: none;
		white-space: nowrap;
	}
	a:hover,
	a.active {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.arrow {
		display: inline-block;
		min-width: 1ch;
		margin-left: 0.25rem;
		font-family: var(--font-mono);
	}
	.num {
		text-align: right;
	}
</style>
