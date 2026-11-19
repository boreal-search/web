<!--
	The current context (an org or Public): a picker when the user has 2+, else just its name.
	The picker is a popover of submit buttons, so arrow keys never switch by accident and it works
	without JS (popovertarget is HTML). Picking posts to /switch-org, which comes back to `redirectTo`.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { beside } from '#lib/popover.js';

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
	let button = $state<HTMLButtonElement>();
	let at = $state({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });

	function place(e: ToggleEvent) {
		if (e.newState !== 'open' || !button) return;
		at = beside(button.getBoundingClientRect(), { width: innerWidth, height: innerHeight });
	}
</script>

{#if contexts.length > 1}
	<div class="switch">
		<span id="{id}-label">{label}</span>
		<button
			type="button"
			class="trigger"
			bind:this={button}
			popovertarget="{id}-list"
			aria-labelledby="{id}-label {id}-current"
		>
			<b id="{id}-current">{current?.label}</b>
			<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
				<path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" />
			</svg>
		</button>
		<form
			id="{id}-list"
			class="list"
			popover="auto"
			method="POST"
			action={resolve('/switch-org')}
			aria-labelledby="{id}-label"
			onbeforetoggle={place}
			style:top={at.top}
			style:bottom={at.bottom}
			style:left={at.left}
			style:right={at.right}
		>
			<input type="hidden" name="redirectTo" value={redirectTo} />
			{#each contexts as c (c.value)}
				<button
					type="submit"
					name="org"
					value={c.value}
					class="quiet"
					aria-current={c.current ? 'true' : undefined}>{c.label}</button
				>
			{/each}
		</form>
	</div>
{:else if current}
	<p class="switch"><span>{label}</span> <b>{current.label}</b></p>
{/if}

<style>
	.switch {
		display: grid;
		gap: 0.25rem;
		margin: 0;
	}
	span {
		font: 400 0.75rem/1.4 var(--font-mono);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	b {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.trigger {
		justify-content: space-between;
		width: 100%;
		min-width: 0;
		background: var(--color-page);
		text-align: left;
	}
	.trigger b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.trigger svg {
		flex: none;
		color: var(--color-muted);
	}
	.list {
		position: fixed;
		inset: unset;
		box-sizing: border-box;
		width: min(16rem, calc(100vw - 1rem));
		margin: 0;
		padding: 0.25rem 0;
		border: 1px solid var(--color-edge);
		background: var(--color-surface);
		color: var(--color-ink);
	}
	.list button {
		display: flex;
		justify-content: flex-start;
		width: 100%;
		min-height: 2.75rem;
		padding: 0 1rem;
		color: var(--color-ink);
		font-weight: 400;
		text-decoration: none;
	}
	.list button:hover {
		background: var(--color-page);
	}
	.list button[aria-current] {
		font-weight: 600;
	}
	.list button[aria-current]::after {
		content: '✓';
		margin-left: auto;
		color: var(--color-muted);
	}
</style>
