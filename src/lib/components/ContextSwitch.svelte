<!--
	The current context (an org or Public): a picker when the user has 2+, else just its name.
	Picking posts to /switch-org (a Switch button without JS), which comes back to `redirectTo`.
-->
<script lang="ts">
	import { resolve } from '$app/paths';

	interface Context {
		value: string;
		label: string;
		current: boolean;
	}

	let {
		contexts,
		label,
		redirectTo
	}: { contexts: readonly Context[]; label: string; redirectTo: string } = $props();

	const id = $props.id();
	let current = $derived(contexts.find((c) => c.current));
</script>

{#if contexts.length > 1}
	<form method="POST" action={resolve('/switch-org')} class="switch">
		<input type="hidden" name="redirectTo" value={redirectTo} />
		<label for="{id}-org">{label}</label>
		<select id="{id}-org" name="org" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			{#each contexts as c (c.value)}
				<option value={c.value} selected={c.current}>{c.label}</option>
			{/each}
		</select>
		<noscript><button type="submit">Switch</button></noscript>
	</form>
{:else if current}
	<p class="switch"><span>{label}</span> <b>{current.label}</b></p>
{/if}

<style>
	.switch {
		display: grid;
		gap: 0.25rem;
		margin: 0;
	}
	label,
	span {
		font: 400 0.75rem/1.4 var(--font-mono);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	select {
		min-width: 0;
		max-width: 100%;
	}
	b {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
</style>
