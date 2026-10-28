<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { describeFailure, pageFailure } from '#lib/failure.js';

	let failure = $derived(pageFailure(page.error ?? { status: page.status, message: '' }));
	// The root layout's nav, when it loaded: the switcher is shown only with 2+ contexts.
	let canSwitch = $derived((page.data.nav?.contexts.length ?? 0) > 0);
	let copy = $derived(describeFailure(failure, { canSwitch }));
	let here = $derived(page.url.pathname + page.url.search);
</script>

<svelte:head>
	<title>{copy.title} · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>{copy.title}</h1>
	<p class="readout">
		<span>Error <b>{page.status}</b></span>
		{#each copy.readout as r (r.label)}
			<span>{r.label} <b>{r.value}</b></span>
		{/each}
	</p>
</div>

<div class="body">
	{#if copy.cause}<p>{copy.cause}</p>{/if}
	<p>{copy.next}</p>
</div>

<p class="actions">
	{#if copy.retry}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the current URL -->
		<a class="button primary" href={here} data-sveltekit-reload>Try again</a>
	{/if}
	<a class={copy.retry ? 'button' : 'button primary'} href={resolve('/(app)')}>Go to data sources</a
	>
</p>

<style>
	.body {
		max-width: 60ch;
		margin-bottom: 1.5rem;
	}
	.body p {
		margin: 0 0 0.5rem;
	}
	.page-head .readout {
		overflow-wrap: anywhere;
	}
</style>
