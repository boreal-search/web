<!--
	The search screen's main area: the trail's steps (composer pinned at the bottom of their column)
	and the selected step's evidence. The evidence can be closed at every size; opening a step, an
	answer, a `[n]` or "View pages" brings it back (`open`).
	- Wide content area (≥ 60rem, sidebar excluded): two panes split by a divider (paneforge) the
	  viewer drags or moves with the arrow keys; double-click resets it. The steps share is kept in
	  a cookie, so the server paints it. The evidence stays in the viewport and scrolls on its own.
	- Narrower: one view at a time. The evidence opens as an overlay over the conversation (the whole
	  screen), as a shallow history entry, so Back (its button, the browser's, the phone gesture) closes it; the
	  conversation keeps its scroll position underneath.
	Before the width is measured (SSR) container queries pick the layout, so the first paint matches.
-->
<script module lang="ts">
	/** What the evidence pane needs to offer its close control. */
	export type EvidenceClose = {
		/** The narrow overlay: a "back to steps" control (and Escape) rather than "close". */
		back: boolean;
		onclose: () => void;
	};
</script>

<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { Pane, PaneGroup, PaneResizer } from 'paneforge';
	import type { Snippet } from 'svelte';
	import { tick, untrack } from 'svelte';
	import { DEFAULT_SPLIT, rememberSplit } from './layout-prefs.js';

	let {
		selectedKey,
		split: initialSplit,
		steps,
		composer,
		evidence
	}: {
		/** Identifies the selected step: a new one starts its pages at the top. */
		selectedKey: string | undefined;
		/** The steps column's remembered share (%) of the two panes. */
		split: number;
		/** `beside`: the evidence sits beside the steps (else closed, or an overlay when opened). */
		steps: Snippet<[{ beside: boolean; open: () => Promise<void> }]>;
		composer: Snippet;
		evidence: Snippet<[EvidenceClose]>;
	} = $props();

	/** Matches `@container panes (max-width: 59.99rem)` below. */
	const NARROW = 960;
	/** Each pane's minimum width (px) beside the other. */
	const MIN_STEPS = 320;
	const MIN_EVIDENCE = 384;

	/** The content area's width; 0 until measured (SSR renders the two-pane markup). */
	let width = $state(0);
	let narrow = $derived(width > 0 && width < NARROW);
	/** Wide: the viewer closed the evidence pane. */
	let closed = $state(false);
	let overlay = $derived(narrow && page.state.evidence === true);
	let shown = $derived(narrow ? overlay : !closed);
	let beside = $derived(shown && !narrow);
	const initial = () => initialSplit;
	let split = $state(initial());
	const minPct = (px: number, fallback: number) =>
		width > 0 && !narrow ? Math.min(45, (px / width) * 100) : fallback;

	let group = $state<ReturnType<typeof PaneGroup>>();
	let pane = $state<HTMLElement>();
	/** What opened the overlay: focus returns there once it closes. */
	let opener: HTMLElement | null = null;

	const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

	/** Show the evidence; resolves once it's laid out (its width decides how a page opens). */
	async function open() {
		if (shown) return;
		if (narrow) {
			opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			pushState('', { evidence: true });
		} else closed = false;
		await tick();
		await frame();
		await frame();
	}

	function close() {
		if (!narrow) closed = true;
		else if (page.state.evidence) history.back();
	}

	function reset() {
		group?.setLayout([DEFAULT_SPLIT, 100 - DEFAULT_SPLIT]);
		split = DEFAULT_SPLIT;
		rememberSplit(split);
	}

	function layoutChanged(layout: number[]) {
		// A lone steps pane (evidence closed) or the stacked layout says nothing about the divider.
		if (layout.length !== 2 || narrow || width === 0) return;
		split = layout[0];
		rememberSplit(split);
	}

	$effect(() => {
		void selectedKey;
		untrack(() => pane?.scrollTo({ top: 0 }));
	});

	$effect(() => {
		if (overlay || !opener) return;
		untrack(() => opener?.focus({ preventScroll: true }));
		opener = null;
	});
</script>

<div class={['panes', { overlay, alone: !shown && !narrow }]} bind:clientWidth={width}>
	<PaneGroup
		bind:this={group}
		direction="horizontal"
		keyboardResizeBy={2}
		onLayoutChange={layoutChanged}
	>
		{#snippet child({ props })}
			<!-- The page scrolls, not the group: drop paneforge's fixed-height, clipped box. -->
			<div {...props} class="grid" style={undefined}>
				<Pane id="steps-pane" order={1} defaultSize={split} minSize={minPct(MIN_STEPS, 20)}>
					{#snippet child({ props })}
						<div {...props} class="steps-col" style:overflow="visible" inert={overlay}>
							<div class="steps">{@render steps({ beside, open })}</div>
							<div class="composer-slot">{@render composer()}</div>
						</div>
					{/snippet}
				</Pane>
				{#if shown}
					<PaneResizer
						class="divider"
						aria-label="Resize steps and pages"
						aria-orientation="vertical"
						title="Drag or use the arrow keys to resize; double-click to reset"
						ondblclick={reset}
					/>
					<Pane
						id="evidence-pane"
						order={2}
						defaultSize={100 - split}
						minSize={minPct(MIN_EVIDENCE, 25)}
					>
						{#snippet child({ props })}
							<!-- The pane's shade runs the full height; the pages stay in view inside it. -->
							<div {...props} class="evidence-pane" style:overflow="visible">
								<aside class="evidence-col" aria-label="Pages" bind:this={pane}>
									{@render evidence({ back: overlay, onclose: close })}
								</aside>
							</div>
						{/snippet}
					</Pane>
				{/if}
			</div>
		{/snippet}
	</PaneGroup>
</div>

<style>
	.panes {
		container: panes / inline-size;
		border-top: 1px solid var(--color-rule);
	}
	.grid {
		display: flex;
		align-items: flex-start;
	}
	.steps-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: calc(100dvh - var(--site-footer));
		padding: 1.5rem 1.25rem 0 0;
	}
	/* The evidence closed: the conversation takes the area, at a reading measure. */
	.alone .steps-col {
		padding-right: 0;
	}
	.alone .steps-col > * {
		width: 100%;
		max-width: 52rem;
		margin-inline: auto;
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
		--options-caret: 0deg;
	}
	/* A wide grab area around a one-pixel rule, as tall as the steps. */
	.grid :global(.divider) {
		flex: none;
		align-self: stretch;
		position: relative;
		width: 0.75rem;
		margin: 0 -0.375rem;
		z-index: 3;
	}
	.grid :global(.divider)::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 50%;
		width: 1px;
		background: var(--color-rule);
	}
	.grid :global(.divider:hover)::before,
	.grid :global(.divider[data-active])::before {
		width: 2px;
		background: var(--color-ink);
	}
	.grid :global(.divider:focus-visible) {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
	/* Its own surface, bleeding into the page's right gutter (a shadow: no layout, no scroll). */
	.evidence-pane {
		min-width: 0;
		align-self: stretch;
		padding-left: 1.25rem;
		background: var(--color-pane);
		box-shadow: 1rem 0 0 var(--color-pane);
	}
	/* Fits the viewport above the site footer, so the pane never scrolls off. */
	.evidence-col {
		position: sticky;
		top: 0;
		max-height: calc(100dvh - var(--site-footer));
		overflow: hidden auto;
		overscroll-behavior: contain;
	}
	/* One view at a time: the conversation, or (over it) the evidence. */
	@container panes (max-width: 59.99rem) {
		.grid {
			display: block;
		}
		.grid :global(.divider),
		.evidence-pane {
			display: none;
		}
		.steps-col {
			padding-right: 0;
		}
		.steps-col > * {
			width: 100%;
			max-width: 52rem;
			margin-inline: auto;
		}
	}
	/* The whole screen, as the reading view; the page underneath keeps its scroll position. */
	.overlay .evidence-pane {
		display: block;
	}
	.overlay .evidence-col {
		position: fixed;
		inset: 0;
		z-index: 20;
		max-height: none;
		padding: 0 max(1rem, env(safe-area-inset-right)) 1.5rem max(1rem, env(safe-area-inset-left));
		background: var(--color-pane);
	}
</style>
