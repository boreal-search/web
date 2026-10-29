<!--
	A query box and its Search button. `new`: the new-search form (the query is required, the
	button is the primary one). `refine`: the selected step's refine form. `children`: what sits
	under the box (search options, "exactly as typed", the last search's problem).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant,
		value = $bindable(''),
		label,
		placeholder,
		disabled = false,
		onsubmit,
		children
	}: {
		variant: 'new' | 'refine';
		value?: string;
		/** The box's (visually hidden) label. */
		label: string;
		placeholder: string;
		disabled?: boolean;
		onsubmit: (e: SubmitEvent) => void;
		children?: Snippet;
	} = $props();

	let id = $derived(variant === 'new' ? 'query' : 'refine');
</script>

<form class={variant === 'new' ? 'search' : 'refine'} {onsubmit}>
	<div class="query">
		<label for={id} class="sr-only">{label}</label>
		<input
			{id}
			type="search"
			name={id}
			required={variant === 'new'}
			bind:value
			autocomplete="off"
			{placeholder}
		/>
		{#if variant === 'new'}
			<button type="submit" class="primary" {disabled}>Search</button>
		{:else}
			<button type="submit">Search</button>
		{/if}
	</div>
	{@render children?.()}
</form>

<style>
	form.search {
		display: grid;
		gap: 1rem;
		max-width: 52rem;
		margin-bottom: 2rem;
	}
	.refine {
		display: grid;
		gap: 0.5rem;
		max-width: 52rem;
		margin: 1.25rem 0 0 2.25rem;
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
	.refine .query input {
		font-size: 1rem;
	}
	.query button {
		padding-inline: 1.5rem;
	}

	@media (max-width: 40rem) {
		.refine {
			margin-left: 0;
		}
	}
</style>
