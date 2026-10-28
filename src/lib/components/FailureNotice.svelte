<!--
	Inline notice for a failure on a page that still renders (engine down on the dashboard, a
	data source, admin pages). Copy comes from `describeFailure`; `effect` says what this page
	can't do because of it. Engine failures are neutral notices, never red (docs/ui.md).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { describeFailure, type Failure } from '#lib/failure.js';

	let { failure, effect }: { failure: Failure; effect?: string } = $props();

	let copy = $derived(describeFailure(failure));
	// Reload the page as a GET: after a failed form post this shows the current state.
	let here = $derived(page.url.pathname + page.url.search);
</script>

<div
	class="notice failure"
	data-tone={copy.tone === 'error' ? 'error' : undefined}
	role={copy.tone === 'error' ? 'alert' : 'status'}
>
	<p><strong>{copy.title}.</strong> {effect}</p>
	<p>{copy.cause} {copy.next}</p>
	{#if copy.readout.length > 0 || copy.retry}
		<p class="readout">
			{#each copy.readout as r (r.label)}
				<span>{r.label} <b>{r.value}</b></span>
			{/each}
			{#if copy.retry}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the current URL -->
				<a href={here} data-sveltekit-reload>Try again</a>
			{/if}
		</p>
	{/if}
</div>

<style>
	.failure p {
		margin: 0 0 0.375rem;
	}
	.failure .readout {
		margin-top: 0.5rem;
		overflow-wrap: anywhere;
	}
	.failure .readout a {
		font-family: var(--font-sans);
		font-size: 0.875rem;
	}
</style>
