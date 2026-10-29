<!--
	One result in the evidence list: its page thumbnail (a PDF link, or on phones once JS runs a
	button that opens the page large under the row), locator, data source and quoted snippet.
-->
<script lang="ts">
	import { resultAnchorId } from '#lib/answer.js';
	import { locator, snippetText } from '#lib/search-view.js';
	import type { StepResult } from '#lib/trail.js';
	import { pdfHref, type Evidence } from './evidence.svelte.js';
	import PageRender from './PageRender.svelte';

	let {
		result: r,
		index: i,
		ev,
		sourceName,
		scopeName,
		permanentLinks,
		interactive
	}: {
		result: StepResult;
		index: number;
		ev: Evidence;
		/** The data source's name if the user can search it now; shown unless it's the title. */
		sourceName: string | undefined;
		/** The name the step recorded, for a data source no longer listed. */
		scopeName: string;
		permanentLinks: boolean;
		/** Phone thumbnails become expand buttons only once JS runs; until then they stay PDF links. */
		interactive: boolean;
	} = $props();

	let outlines = $derived(ev.boxesOn(i + 1));
</script>

<!-- Click anywhere on a row to show its page; keyboard users have J/K and focus. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<li
	id={resultAnchorId(i + 1)}
	tabindex="-1"
	aria-current={i === ev.current ? 'true' : undefined}
	onclick={() => ev.select(i)}
	onfocusin={() => ev.select(i)}
>
	{#if ev.wide.current || !interactive}
		<a
			class="sheet thumb"
			href={pdfHref(r)}
			target="_blank"
			rel="external noopener"
			aria-label="Open page {r.page_number} of {r.document_title} (PDF)"
		>
			<PageRender
				result={r}
				{outlines}
				{permanentLinks}
				failed={ev.failed}
				variant="thumb"
				lazy={i >= 10}
			/>
		</a>
	{:else}
		<button
			type="button"
			class="sheet thumb"
			aria-expanded={ev.expanded === i}
			aria-controls="page-{i + 1}"
			aria-label="Show page {r.page_number} of {r.document_title} large"
			onclick={(e) => ev.expand(i, e.currentTarget)}
		>
			<PageRender
				result={r}
				{outlines}
				{permanentLinks}
				failed={ev.failed}
				variant="thumb"
				lazy={i >= 10}
			/>
		</button>
	{/if}
	<div class="hit">
		<h3 class="loc"><span class="rank">{i + 1}</span>{locator(r).join(' · ')}</h3>
		<p class="meta">
			{#if sourceName !== r.document_title}
				<span class="muted">{sourceName ?? scopeName}</span>
			{/if}
			<a class="loc" href={pdfHref(r)} target="_blank" rel="external noopener"
				>PDF p.{r.page_number} ↗</a
			>
		</p>
		{#if r.snippet}
			<blockquote class="source">{snippetText(r.snippet)}</blockquote>
		{/if}
	</div>
	{#if ev.expanded === i && !ev.wide.current}
		<figure
			class="expanded"
			id="page-{i + 1}"
			aria-label="Page {r.page_number} of {r.document_title}"
		>
			<figcaption>
				<span class="loc">{i + 1} · p.{r.page_number}</span>
				<a class="loc" href={pdfHref(r)} target="_blank" rel="external noopener"
					>PDF p.{r.page_number} ↗</a
				>
				<button type="button" class="quiet" onclick={ev.collapse}>Close</button>
			</figcaption>
			<div class="sheet zoomed">
				<PageRender result={r} {outlines} {permanentLinks} failed={ev.failed} variant="expanded" />
			</div>
			{#if ev.active?.ref === i + 1 && ev.active.quote}
				<p class="sr-only">Outlined on the page: {ev.active.quote}</p>
			{/if}
		</figure>
	{/if}
</li>

<style>
	/* Phones: a small thumbnail beside each hit, not a full-width page per result. */
	li {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		gap: 0.75rem 1.25rem;
		padding: 1.25rem 0;
		border-bottom: 1px solid var(--color-rule);
		scroll-margin-top: 1rem;
	}
	li:focus-visible {
		outline-offset: -2px;
	}
	.hit {
		min-width: 0;
	}
	.hit h3 {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.25rem;
		color: var(--color-ink);
		overflow-wrap: anywhere;
	}
	.rank {
		flex: none;
		min-width: 1.5rem;
		font-weight: 500;
		color: var(--color-muted);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 1rem;
		margin: 0 0 0.5rem 2.25rem;
		font-size: 0.875rem;
	}
	.meta a.loc {
		margin-left: auto;
	}
	.hit .source {
		margin: 0 0 0 2.25rem;
		max-width: 68ch;
		font-size: 1rem;
	}
	/* Hug the image: a grid item would otherwise stretch the frame to the row's height. */
	.thumb {
		align-self: start;
		width: 100%;
		color: inherit;
		text-decoration: none;
	}
	button.thumb {
		min-height: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: var(--color-sheet);
		cursor: zoom-in;
	}
	button.thumb[aria-expanded='true'] {
		cursor: zoom-out;
	}
	/* Phones: the page opened large under its row, full width. */
	.expanded {
		grid-column: 1 / -1;
		display: grid;
		gap: 0.5rem;
		margin: 0;
	}
	.expanded figcaption {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 1rem;
	}
	.expanded figcaption button {
		margin-left: auto;
	}

	@media (min-width: 40rem) {
		li {
			grid-template-columns: 12rem minmax(0, 1fr);
		}
	}
	/* Desktop: a narrow contact strip of pages beside the selected page at reading size. */
	@media (min-width: 64rem) {
		li {
			grid-template-columns: 5.5rem minmax(0, 1fr);
			padding: 1rem 0.75rem 1rem 0;
			cursor: default;
		}
		li[aria-current='true'] {
			background: var(--color-surface);
			box-shadow: inset 2px 0 0 var(--color-ink);
			padding-left: 0.75rem;
		}
		li:not([aria-current='true']) {
			padding-left: 0.75rem;
		}
	}
</style>
