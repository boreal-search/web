<!--
	The evidence pane's sticky header: which step these pages belong to, the close control ("Close";
	in the narrow overlay "Steps", its way back, which takes focus) and the results keys.
-->
<script lang="ts">
	import { stepNumber, type TrailStep } from '#lib/trail.js';
	import type { EvidenceClose } from './EvidencePanes.svelte';

	let {
		step,
		keys,
		close,
		height = $bindable(0)
	}: {
		step: TrailStep;
		/** Show the keyboard hints (more than one result). */
		keys: boolean;
		close: EvidenceClose;
		/** Its rendered height: the pinned page sits just under it. */
		height?: number;
	} = $props();
</script>

<header class="evidence-head" bind:clientHeight={height}>
	<div class="title">
		{#if close.back}
			<button type="button" class="quiet close" aria-label="Back to steps" onclick={close.onclose}
				><span aria-hidden="true">←</span> Steps</button
			>
		{/if}
		<h2 id="evidence-heading">
			<span class="sr-only">Pages for step </span><span class="num">{stepNumber(step.n)}</span>
			<span class="dot" aria-hidden="true">·</span>
			<span class="q">{step.query}</span>
		</h2>
		{#if !close.back}
			<button type="button" class="quiet close" aria-label="Close pages" onclick={close.onclose}
				>Close <span aria-hidden="true">×</span></button
			>
		{/if}
	</div>
	{#if keys}
		<p class="keys muted">
			<span><kbd>J</kbd> <kbd>K</kbd> next and previous</span>
			<span><kbd>Space</kbd> zoom page</span>
			<span><kbd>O</kbd> open PDF at page</span>
			<span><kbd>C</kbd> copy citation</span>
		</p>
	{/if}
</header>

<style>
	/* Stays in view while the pane scrolls: which step these pages belong to. */
	.evidence-head {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		gap: 0.25rem;
		padding: 0.5rem 0 0.75rem;
		border-bottom: 1px solid var(--color-rule);
		background: var(--color-pane);
	}
	.title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	h2 {
		flex: 1;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
		margin: 0;
		font-size: 1.125rem;
	}
	.close {
		flex: none;
		min-height: 2.75rem;
		padding-inline: 0.5rem;
		color: var(--color-muted);
		font: 500 0.8125rem/1 var(--font-mono);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.close:first-child {
		margin-left: -0.5rem;
	}
	.close:hover {
		color: var(--color-ink);
	}
	.num {
		flex: none;
		font: 500 0.9375rem/1.2 var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
	}
	.dot {
		color: var(--color-muted);
	}
	.q {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.keys {
		display: none;
		flex-wrap: wrap;
		gap: 0 1rem;
		margin: 0;
		font-size: 0.8125rem;
	}
	@media (hover: hover) and (pointer: fine) {
		.keys {
			display: flex;
		}
	}
</style>
