<!--
	The one query box. An empty trail: a new search, under the heading; otherwise the page
	continues from the latest step, and the box sits in the steps column's pinned slot
	(EvidencePanes). `onengage`: the user focused or typed in the box (Search options collapse).
	`children`: under the box (Search options, the last search's problem); Search options open
	from here (below it, or upward in the pinned slot).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(''),
		label,
		placeholder,
		disabled = false,
		onsubmit,
		onengage,
		children
	}: {
		value?: string;
		/** The box's (visually hidden) label. */
		label: string;
		placeholder: string;
		disabled?: boolean;
		onsubmit: (e: SubmitEvent) => void;
		onengage?: () => void;
		children?: Snippet;
	} = $props();
</script>

<form class="composer" {onsubmit}>
	<div class="query">
		<label for="query" class="sr-only">{label}</label>
		<input
			id="query"
			type="search"
			name="query"
			required
			bind:value
			autocomplete="off"
			{placeholder}
			onfocus={onengage}
			oninput={onengage}
		/>
		<button type="submit" class="primary" {disabled}>Search</button>
	</div>
	{@render children?.()}
</form>

<style>
	.composer {
		position: relative;
		display: grid;
		gap: 0.5rem;
		max-width: 52rem;
	}
	.query {
		display: flex;
		gap: 0.5rem;
	}
	.query input {
		flex: 1;
		min-width: 0;
		font-size: 1.0625rem;
	}
	.query button {
		padding-inline: 1.5rem;
	}
</style>
