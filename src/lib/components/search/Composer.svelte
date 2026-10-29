<!--
	The one query box, pinned to the bottom of its column (sticky). An empty trail: a new search;
	otherwise the page continues from the latest step. `onengage`: the user focused or typed in
	the box (Search options collapse). `children`: under the box (Search options, the last
	search's problem); Search options open upward from here.
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
		position: sticky;
		bottom: 0;
		z-index: 2;
		display: grid;
		gap: 0.5rem;
		max-width: 52rem;
		padding: 0.75rem 0 1rem;
		border-top: 1px solid var(--color-rule);
		background: var(--color-page);
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
