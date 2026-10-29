<!--
	The selected step's pages, headed by its number and query: the result list and, in a wide pane,
	the selected page at reading size beside it (the pane's width decides, not the viewport). Owns
	the results keyboard (J/K/Space/O/C) and the "Citation copied" status. In a modal its sticky
	header sits under the modal's (`--sticky-top`).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { stepNumber, type TrailStep } from '#lib/trail.js';
	import { pdfHref, type Evidence } from './evidence.svelte.js';
	import PageRender from './PageRender.svelte';
	import ResultRow from './ResultRow.svelte';

	let {
		step,
		ev,
		sourceNames,
		permanentLinks
	}: {
		/** The selected step, or null when there is none. */
		step: TrailStep | null;
		ev: Evidence;
		/** Data source names the user can search now, by id. */
		sourceNames: ReadonlyMap<string, string>;
		permanentLinks: boolean;
	} = $props();

	// Phone thumbnails become expand buttons only once JS runs; until then they stay PDF links.
	let interactive = $state(false);
	/** The sticky header's height: the pinned page sits just under it. */
	let headHeight = $state(0);
	onMount(() => {
		interactive = true;
	});

	let section = $state<HTMLElement>();
	/** The results keys work only while these pages are what's shown: not under another open
	 * modal (Share, Delete, Trails), nor inside the closed phone "Pages" modal. */
	function onkeydown(e: KeyboardEvent) {
		if (!section || section.closest('dialog:not([open])')) return;
		for (const d of document.querySelectorAll('dialog[open]')) if (!d.contains(section)) return;
		ev.onkeydown(e);
	}
</script>

<svelte:window {onkeydown} />

{#if step}
	{@const results = ev.results}
	{@const shown = ev.shown}
	<section
		bind:this={section}
		class="evidence"
		aria-labelledby="evidence-heading"
		bind:clientWidth={ev.paneWidth}
		style:--head="{headHeight}px"
	>
		<header class="evidence-head" bind:clientHeight={headHeight}>
			<h2 id="evidence-heading">
				<span class="sr-only">Pages for step </span><span class="num">{stepNumber(step.n)}</span>
				<span class="dot" aria-hidden="true">·</span>
				<span class="q">{step.query}</span>
			</h2>
			{#if results.length > 1}
				<p class="keys muted">
					<span><kbd>J</kbd> <kbd>K</kbd> next and previous</span>
					<span><kbd>Space</kbd> zoom page</span>
					<span><kbd>O</kbd> open PDF at page</span>
					<span><kbd>C</kbd> copy citation</span>
				</p>
			{/if}
		</header>
		{#if step.readout.search === null}
			<p class="empty">
				{step.readout.finished
					? "No pages to show: the search didn't finish."
					: 'Pages appear here as they arrive.'}
			</p>
		{:else if results.length === 0}
			<p class="empty">
				Nothing matched in the pages searched. Try other wording, or tick more data sources.
			</p>
		{:else}
			<div class={['layout', ev.zoomed && 'zoomed']}>
				<ol class="hits">
					{#each results as r, i (`${r.document_id}:${r.page_number}`)}
						<ResultRow
							result={r}
							index={i}
							{ev}
							sourceName={sourceNames.get(r.data_source_id)}
							scopeName={step.scope.data_source_names[r.data_source_id] ?? r.data_source_id}
							{permanentLinks}
							{interactive}
						/>
					{/each}
				</ol>

				{#if shown && ev.wide}
					<figure class="viewer" aria-label="Selected page">
						<a
							class={['sheet', ev.zoomed && 'zoomed']}
							href={pdfHref(shown)}
							target="_blank"
							rel="external noopener"
							aria-label="Open page {shown.page_number} of {shown.document_title} (PDF)"
						>
							<PageRender
								result={shown}
								outlines={ev.boxesOn(ev.current + 1)}
								{permanentLinks}
								failed={ev.failed}
								variant="viewer"
								zoomed={ev.zoomed}
							/>
						</a>
						<figcaption>
							<span class="loc"
								>{ev.current + 1} · {shown.document_title} · p.{shown.page_number}</span
							>
							{#if ev.active?.ref === ev.current + 1 && ev.active.quote}
								<span class="sr-only">Outlined on the page: {ev.active.quote}</span>
							{/if}
							<button
								type="button"
								class="quiet zoom"
								aria-pressed={ev.zoomed}
								onclick={() => (ev.zoomed = !ev.zoomed)}>Zoom</button
							>
							<a class="loc" href={pdfHref(shown)} target="_blank" rel="external noopener"
								>PDF p.{shown.page_number} ↗</a
							>
						</figcaption>
					</figure>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<p class="copied readout" role="status">{ev.copyStatus}</p>

<style>
	/* The pane's width, not the viewport's, sets the layout below (and in ResultRow). */
	.evidence {
		container: evidence / inline-size;
	}
	/* Stays in view while the pane scrolls: which step these pages belong to. */
	.evidence-head {
		position: sticky;
		top: var(--sticky-top, 0);
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-rule);
		background: var(--color-page);
	}
	.evidence-head h2 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
		margin: 0;
		font-size: 1.125rem;
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
	.empty {
		margin-top: 1rem;
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
	.layout {
		display: grid;
		gap: 2rem;
	}
	.hits {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.copied {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-edge);
		border-radius: 3px;
		background: var(--color-surface);
	}
	.copied:empty {
		padding: 0;
		border: 0;
	}
	.viewer {
		margin: 0;
	}

	/* A pane wide enough for a reading-size page. Medium: the selected page sits above the list,
	   pinned under the pane's header, with the list scrolling beneath it. */
	@container evidence (min-width: 36rem) {
		.viewer {
			display: grid;
			gap: 0.5rem;
			order: -1;
			position: sticky;
			top: calc(var(--sticky-top, 0px) + var(--head, 4rem));
			z-index: 1;
			padding: 1rem 0 0.75rem;
			border-bottom: 1px solid var(--color-rule);
			background: var(--color-page);
		}
		.viewer .sheet {
			justify-self: start;
		}
		.viewer :global(img) {
			max-height: 45dvh;
		}
		.layout {
			gap: 0;
		}
		.layout.zoomed .viewer {
			position: static;
		}
		.layout.zoomed .viewer :global(img) {
			max-height: none;
		}
		figcaption {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: 0 1rem;
		}
		/* A control shaped like the locators beside it. */
		.zoom {
			min-height: 0;
			margin-left: auto;
			padding: 0;
			font: 500 0.8125rem/1.5 var(--font-mono);
			letter-spacing: 0.02em;
			text-transform: uppercase;
		}
	}
	/* Wide: a contact strip of pages beside the selected page. */
	@container evidence (min-width: 52rem) {
		.layout {
			grid-template-columns: minmax(18rem, 2fr) minmax(0, 3fr);
			align-items: start;
			gap: 1.25rem;
		}
		.viewer {
			order: 0;
			border-bottom: 0;
		}
		.viewer :global(img) {
			max-height: calc(100dvh - var(--head, 4rem) - 3rem);
		}
		/* Zoomed: the selected page takes most of the width, at full size. */
		.layout.zoomed {
			grid-template-columns: minmax(10rem, 1fr) minmax(0, 3fr);
		}
	}
</style>
