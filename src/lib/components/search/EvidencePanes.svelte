<!--
	The search screen's main area: the trail's steps (composer pinned at the bottom of their column)
	beside the selected step's evidence, which stays in the viewport and scrolls on its own. In a
	narrow main column (phones, or squeezed beside a sidebar) there is no second pane: `steps` gets
	`modal` and `open()`, which shows the evidence as a full-screen modal.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import Modal from './Modal.svelte';

	let {
		selectedKey,
		steps,
		composer,
		evidence
	}: {
		/** Identifies the selected step: a new one starts its pages at the top. */
		selectedKey: string | undefined;
		steps: Snippet<[{ modal: boolean; open: () => void }]>;
		composer: Snippet;
		evidence: Snippet;
	} = $props();

	/** The container's width; 0 until measured (SSR renders the two-pane markup). */
	let width = $state(0);
	/** Matches `@container panes (min-width: 45rem)` below. */
	let modal = $derived(width > 0 && width < 720);
	let pane = $state<HTMLElement>();
	let sheetOpen = $state(false);

	const open = () => (sheetOpen = true);

	$effect(() => {
		void selectedKey;
		untrack(() => pane?.scrollTo({ top: 0 }));
	});
</script>

<div class="panes" bind:clientWidth={width}>
	<div class="grid">
		<div class="steps-col">
			<div class="steps">{@render steps({ modal, open })}</div>
			<div class="composer-slot">{@render composer()}</div>
		</div>
		{#if !modal}
			<aside class="evidence-col" aria-label="Pages" bind:this={pane}>
				{@render evidence()}
			</aside>
		{/if}
	</div>
</div>
{#if modal}
	<Modal bind:open={sheetOpen} title="Pages" closeLabel="Back to steps" full>
		{@render evidence()}
	</Modal>
{/if}

<style>
	.panes {
		container: panes / inline-size;
		border-top: 1px solid var(--color-rule);
	}
	.grid {
		display: grid;
		gap: 0 2rem;
	}
	.steps-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding-top: 1.5rem;
	}
	.steps {
		flex: 1;
	}
	/* Pinned to the bottom of the viewport; Search options open upward from here. */
	.composer-slot {
		position: sticky;
		bottom: 0;
		z-index: 2;
		padding: 0.75rem 0 1rem;
		border-top: 1px solid var(--color-rule);
		background: var(--color-page);
		--options-top: auto;
		--options-bottom: calc(100% + 0.25rem);
	}
	.evidence-col {
		display: none;
	}
	/* Two panes once the main column is wide enough: steps ~40 %, evidence ~60 %. */
	@container panes (min-width: 45rem) {
		.grid {
			grid-template-columns: minmax(18rem, 2fr) minmax(24rem, 3fr);
			align-items: start;
		}
		/* Both columns fit the viewport above the site footer, so the pane never scrolls off. */
		.steps-col {
			min-height: calc(100dvh - var(--site-footer));
		}
		.evidence-col {
			display: block;
			position: sticky;
			top: 0;
			max-height: calc(100dvh - var(--site-footer));
			overflow-y: auto;
			overscroll-behavior: contain;
			padding-left: 1.5rem;
			border-left: 1px solid var(--color-rule);
		}
	}
</style>
