<!--
	The selected step's pages: the result list and, on wide screens, the selected page at reading
	size beside it. Owns the results keyboard (J/K/Space/O/C) and the "Citation copied" status.
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
	onMount(() => {
		interactive = true;
	});
</script>

<svelte:window onkeydown={ev.onkeydown} />

{#if step && step.readout.search !== null}
	{@const results = ev.results}
	{@const shown = ev.shown}
	<section class="band evidence" aria-labelledby="evidence-heading">
		<div class="evidence-head">
			<h2 id="evidence-heading">
				Pages <span class="loc">step {stepNumber(step.n)}</span>
			</h2>
			{#if results.length > 1}
				<p class="keys muted">
					<span><kbd>J</kbd> <kbd>K</kbd> next and previous</span>
					<span><kbd>Space</kbd> zoom page</span>
					<span><kbd>O</kbd> open PDF at page</span>
					<span><kbd>C</kbd> copy citation</span>
				</p>
			{/if}
		</div>
		{#if results.length === 0}
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

				{#if shown && ev.wide.current}
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
	.evidence-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem 1rem;
		margin-bottom: 1rem;
	}
	.evidence-head h2 {
		margin: 0;
	}
	.evidence-head h2 .loc {
		margin-left: 0.5rem;
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
		border-top: 1px solid var(--color-rule);
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

	/* Desktop: a narrow contact strip of pages beside the selected page at reading size. */
	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) minmax(0, 30rem);
			align-items: start;
		}
		.viewer {
			display: grid;
			gap: 0.5rem;
			position: sticky;
			top: 1rem;
		}
		.viewer .sheet {
			justify-self: start;
		}
		/* Zoomed: the selected page takes most of the width, at full size. */
		.layout.zoomed {
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		}
		.layout.zoomed .viewer {
			position: static;
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
</style>
