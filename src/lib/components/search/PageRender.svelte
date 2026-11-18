<!--
	A page render with the cited words highlighted in their framed paragraphs (a thumbnail shows
	the frames only; page fractions as percentages of the frame), or a plain line when the image is
	missing. width/height are an aspect hint only, to reserve space. `variant`: where it sits
	(thumbnail, the large viewer, or opened under a row on phones).
-->
<script lang="ts">
	import type { Outline } from '#lib/answer.js';
	import { missingText } from '#lib/search-view.js';
	import type { StepResult } from '#lib/trail.js';
	import type { SvelteSet } from 'svelte/reactivity';
	import { pageSrc } from './evidence.svelte.js';

	let {
		result: r,
		outlines,
		permanentLinks,
		failed,
		variant,
		zoomed = false,
		lazy = false
	}: {
		result: StepResult;
		outlines: Outline[];
		permanentLinks: boolean;
		/** Image URLs that failed to load, shared by every render of the page. */
		failed: SvelteSet<string>;
		variant: 'thumb' | 'viewer' | 'expanded';
		zoomed?: boolean;
		lazy?: boolean;
	} = $props();

	let src = $derived(pageSrc(r, permanentLinks));
	let shown = $derived(
		variant === 'thumb' ? outlines.filter((o) => o.shape !== 'words') : outlines
	);
</script>

{#if src === null || failed.has(src)}
	<span class={['expired', variant]}>{missingText(r, permanentLinks)}</span>
{:else}
	<span class={['frame', variant, zoomed && 'zoomed']}>
		<img
			{src}
			alt="Page {r.page_number} of {r.document_title}"
			width="935"
			height="1210"
			loading={lazy ? 'lazy' : 'eager'}
			decoding="async"
			onerror={() => failed.add(src)}
		/>
		{#each shown as { box: [x0, y0, x1, y1], status, shape }, i (i)}
			<span
				class="mark"
				data-shape={shape}
				data-status={status}
				aria-hidden="true"
				style:left="{x0 * 100}%"
				style:top="{y0 * 100}%"
				style:width="{(x1 - x0) * 100}%"
				style:height="{(y1 - y0) * 100}%"
			></span>
		{/each}
	</span>
{/if}

<style>
	/* The frame the cited-text boxes are placed in: exactly the image's box. */
	.frame {
		display: block;
		position: relative;
	}
	.mark {
		--status: var(--color-sheet-mark-not-checked);
		position: absolute;
		pointer-events: none;
	}
	[data-status='verified'] {
		--status: var(--color-sheet-mark-verified);
	}
	[data-status='unsupported'] {
		--status: var(--color-sheet-mark-unsupported);
	}
	/* Colours sit on the paper, so the light values in both themes; multiplied so words stay black. */
	/* A box with no paragraph around it: moss wash and a light edge by check status. */
	[data-shape='box'] {
		background: var(--color-sheet-mark);
		mix-blend-mode: multiply;
		outline: 1.5px solid var(--status);
		border-radius: 2px;
	}
	/* The cited words: a highlighter tint in the status colour. */
	[data-shape='words'] {
		background: color-mix(in srgb, var(--status) 30%, transparent);
		mix-blend-mode: multiply;
	}
	/* Their paragraph, as context only. 1 px off its words so the edge doesn't touch the tint;
	   more would cut the next line when a frame holds only some of a block's lines. */
	[data-shape='frame'] {
		outline: 1px solid color-mix(in srgb, var(--status) 35%, transparent);
		outline-offset: 1px;
		border-radius: 2px;
	}
	.thumb [data-shape='box'] {
		outline-width: 1px;
	}
	/* Paragraph gaps there are 2-3 px: the offset would close them. With no words shown, the frame
	   takes the full status colour or it vanishes at this size. */
	.thumb [data-shape='frame'] {
		outline-offset: 0;
		outline-color: var(--status);
	}
	.expired {
		display: block;
		padding: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-ink);
		background: var(--color-surface);
	}

	@container evidence (min-width: 28rem) {
		.expired {
			padding: 1rem;
			font-size: 0.875rem;
		}
	}
	@container evidence (min-width: 36rem) {
		.expired {
			padding: 0.5rem;
			font-size: 0.75rem;
		}
		.expired.viewer {
			padding: 1.5rem;
			font-size: 0.875rem;
		}
		/* Its height cap is the evidence pane's call (it knows the layout). */
		.viewer img {
			width: auto;
			max-width: 100%;
		}
	}
</style>
