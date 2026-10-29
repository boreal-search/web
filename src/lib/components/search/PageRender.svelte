<!--
	A page render with the cited text outlined on it (page fractions as percentages of the frame),
	or a plain line when the image is missing. width/height are an aspect hint only, to reserve
	space. `variant`: where it sits (thumbnail, the large viewer, or opened under a row on phones).
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
		{#each outlines as { box: [x0, y0, x1, y1], status }, i (i)}
			<span
				class="mark"
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
	/* Moss wash multiplied onto the paper so the words stay black; a light edge by check status
	   (same in both themes), on the box itself so it doesn't run into the lines around it. */
	.mark {
		position: absolute;
		pointer-events: none;
		background: var(--color-sheet-mark);
		mix-blend-mode: multiply;
		outline: 1.5px solid var(--color-sheet-mark-not-checked);
		outline-offset: 0;
		border-radius: 2px;
	}
	.mark[data-status='verified'] {
		outline-color: var(--color-sheet-mark-verified);
	}
	.mark[data-status='unsupported'] {
		outline-color: var(--color-sheet-mark-unsupported);
	}
	.thumb .mark {
		outline-width: 1px;
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
