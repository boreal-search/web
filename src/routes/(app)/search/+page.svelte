<script lang="ts">
	import { enhance } from '$app/forms';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import { answerCheck, answerCheckLabel, resultAnchorId, splitCitations } from '#lib/answer.js';
	import { count, plural } from '#lib/format.js';
	import { checkFlag, isTypingTarget, pagesSearched, seconds, step } from '#lib/search-view.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let all = $derived(data.groups.flatMap((g) => g.dataSources));
	let groups = $derived(data.groups.filter((g) => g.dataSources.length > 0));
	let noOrg = $derived(data.access.memberships.length === 0);
	let sourceNames = $derived(new Map(all.map((ds) => [ds.id, ds.name])));
	// Keep the user's last selection across submits; default to everything they can see.
	let selected = $derived(new Set(form?.requested ?? all.map((ds) => ds.id)));
	// Bound, so re-renders (the button's disabled state) never overwrite what the user typed or ticked.
	let query = $derived(form?.query ?? '');
	let draftOn = $derived(form?.answer ?? true);

	let outcome = $derived(form && 'outcome' in form ? form.outcome : null);
	let results = $derived(outcome?.response.results ?? []);
	let answerNotice = $derived(form && 'answerNotice' in form ? form.answerNotice : null);
	let answer = $derived(
		outcome && (outcome.answer.kind === 'ok' || outcome.answer.kind === 'abstained')
			? outcome.answer.answer
			: null
	);
	let segments = $derived(answer ? splitCitations(answer.text, results.length) : []);
	let check = $derived(answer ? answerCheck(answer) : null);
	let claims = $derived(check?.state === 'checked' ? check.claims : []);
	let summaryPages = $derived(new Set(answer?.sources.map((s) => s.ref) ?? []).size);

	let pdfCount = $derived(new Set(results.map((r) => r.document_id)).size);
	let searchedPages = $derived(
		pagesSearched(
			(form?.requested ?? []).map((id) => all.find((ds) => ds.id === id)?.pages ?? null)
		)
	);

	// The result shown large beside the list; back to the top result on every new search.
	let current = $derived.by(() => {
		void results;
		return 0;
	});
	let shown = $derived(results[current] ?? null);
	// The large page sits beside the list only on wide screens; phones show each page in its row.
	const wide = new MediaQuery('min-width: 64rem', false);
	// Signed image URLs expire after ~4 h; a failed render shows a plain line instead.
	const failed = new SvelteSet<string>();

	function select(i: number, focus = false) {
		current = i;
		if (!focus) return;
		const el = document.getElementById(resultAnchorId(i + 1));
		el?.focus({ preventScroll: true });
		el?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(e: KeyboardEvent) {
		if (results.length === 0 || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target))
			return;
		const delta = e.key === 'j' ? 1 : e.key === 'k' ? -1 : 0;
		if (delta === 0) return;
		e.preventDefault();
		select(step(current, delta, results.length), true);
	}

	// Waiting: nothing for 300 ms, then a bar and a seconds counter (docs/ui.md, "Waiting").
	let searching = $state(false);
	let drafting = $state(false);
	let elapsed = $state(0);
	// No stage reports from the engine: the bar eases toward the typical time and never fills.
	let expected = $derived(drafting ? 4000 : 1000);
	let progress = $derived(Math.min(0.9, 1 - Math.exp(-elapsed / expected)));

	const snippetText = (s: string) => `…${s.replace(/\s+/g, ' ').trim()}…`;
</script>

<svelte:window {onkeydown} />

<div class="page-head">
	<h1>Search</h1>
	{#if searching && elapsed >= 300}
		<div class="waiting" role="status">
			<span class="progress" style:--value={progress}></span>
			<span class="readout">
				<span
					>{drafting ? 'Searching and drafting' : 'Searching'} · <b>{seconds(elapsed)}</b> s</span
				>
			</span>
		</div>
	{:else if outcome}
		<p class="readout" role="status">
			<span><b>{results.length}</b> {plural(results.length, 'page')}</span>
			{#if pdfCount > 0}<span><b>{pdfCount}</b> {plural(pdfCount, 'PDF')}</span>{/if}
			{#if searchedPages !== null}
				<span><b>{count(searchedPages)}</b> pages searched</span>
			{/if}
			<span>results <b>{seconds(outcome.response.retrieval_ms)}</b> s</span>
			{#if outcome.response.reranked}<span>reranked</span>{/if}
		</p>
	{/if}
</div>

{#if data.access.dataSourceIds.length === 0}
	<p class="empty">
		{#if noOrg}
			You're not in an org yet, and there are no public data sources. Ask your org admin for an
			invite, or contact us to search your own documents.
		{:else}
			Your org doesn't have access to any data sources yet. Ask a platform admin to grant it some.
		{/if}
	</p>
{:else}
	{#if data.engineError}
		<p class="notice" role="status">{data.engineError}</p>
	{/if}
	<form
		method="POST"
		class="search"
		use:enhance={({ formData }) => {
			drafting = formData.get('answer') === 'on';
			searching = true;
			elapsed = 0;
			const start = performance.now();
			const tick = setInterval(() => (elapsed = performance.now() - start), 100);
			return async ({ update }) => {
				try {
					await update({ reset: false });
				} finally {
					clearInterval(tick);
					searching = false;
				}
			};
		}}
	>
		<div class="query">
			<label for="query" class="sr-only">Query</label>
			<input
				id="query"
				type="search"
				name="query"
				required
				bind:value={query}
				autocomplete="off"
				placeholder="Search documents"
			/>
			<button type="submit" class="primary" disabled={searching || groups.length === 0}>
				Search
			</button>
		</div>

		<div class="scope">
			{#each groups as group (group.label)}
				<fieldset>
					<legend>{group.label}</legend>
					<div class="corpora">
						{#each group.dataSources as ds (ds.id)}
							<label class="check">
								<input
									type="checkbox"
									name="data_source_ids"
									value={ds.id}
									checked={selected.has(ds.id)}
								/>
								<span>
									{ds.name}
									{#if ds.pages !== null}<span class="pages">{count(ds.pages)} p.</span>{/if}
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
			{:else}
				<p class="muted">No data sources are available right now.</p>
			{/each}
		</div>

		<div class="options">
			<label class="check">
				<input type="checkbox" name="answer" value="on" bind:checked={draftOn} />
				Draft an answer
			</label>
			<details>
				<summary>Options</summary>
				<div class="option-fields">
					<label class="count">
						Results
						<input type="number" name="top_k" min="1" max="50" value={form?.topK ?? 10} />
					</label>
					<label class="check">
						<input type="checkbox" name="rerank" value="on" checked={form?.rerank ?? true} />
						Rerank
					</label>
				</div>
			</details>
		</div>

		{#if form?.error}
			<p class="notice" role="status">{form.error}</p>
		{/if}
	</form>

	{#if noOrg}
		<p class="muted">Want your own documents? Contact us.</p>
	{/if}
{/if}

{#if answer && check}
	<section class="band summary" aria-labelledby="summary-heading" aria-busy={searching}>
		<h2 id="summary-heading">
			Generated summary
			{#if check.state === 'checked'}
				<span class="muted">· each claim checked against its page</span>
			{/if}
		</h2>
		<p class="status">
			<span class="flag" data-state={checkFlag(check)}>{answerCheckLabel(check)}</span>
		</p>
		<p class="answer">
			{#each segments as seg, i (i)}
				{#if seg.kind === 'cite'}
					<a
						class="cite"
						href="#{resultAnchorId(seg.ref)}"
						aria-label="Result {seg.ref}"
						onclick={() => select(seg.ref - 1, true)}>[{seg.ref}]</a
					>
				{:else}
					{seg.text}
				{/if}
			{/each}
		</p>
		{#if claims.length > 0}
			<ul class="claims" aria-label="Claims checked">
				{#each claims as c, i (i)}
					{@const r = c.ref !== null ? results[c.ref - 1] : undefined}
					<li>
						<span class="flag" data-state={c.state}>
							{c.state === 'verified' ? 'Verified' : 'Unsupported'}
						</span>
						<span class="claim">{c.text}</span>
						{#if c.ref !== null && r}
							<a
								class="loc"
								href="#{resultAnchorId(c.ref)}"
								onclick={() => c.ref !== null && select(c.ref - 1, true)}
								>[{c.ref}] p.{r.page_number}</a
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		<p class="readout">
			{#if summaryPages > 0}<span
					>summary from <b>{summaryPages}</b> {plural(summaryPages, 'page')}</span
				>{/if}
			{#if answer.generation_ms > 0}
				<span>drafted <b>{seconds(answer.generation_ms)}</b> s</span>
			{/if}
			{#if answer.verify_ms > 0}
				<span>checked <b>{seconds(answer.verify_ms)}</b> s</span>
			{/if}
			<span>model <b>{answer.model}</b></span>
		</p>
	</section>
{:else if answerNotice}
	<section class="band summary" aria-label="Generated summary">
		<p class="notice" role="status">{answerNotice}</p>
	</section>
{/if}

{#if outcome}
	<section class="band evidence" aria-labelledby="evidence-heading" aria-busy={searching}>
		<div class="evidence-head">
			<h2 id="evidence-heading">Pages</h2>
			{#if results.length > 1}
				<p class="keys muted">
					<kbd>J</kbd> <kbd>K</kbd> next and previous result
				</p>
			{/if}
		</div>
		{#if results.length === 0}
			<p class="empty">
				Nothing matched in the pages searched. Try other wording, or tick more data sources.
			</p>
		{:else}
			<div class="layout">
				<ol class="hits">
					{#each results as r, i (`${r.document_id}:${r.page_number}`)}
						<!-- Click anywhere on a row to show its page; keyboard users have J/K and focus. -->
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
						<li
							id={resultAnchorId(i + 1)}
							tabindex="-1"
							aria-current={i === current ? 'true' : undefined}
							onclick={() => select(i)}
							onfocusin={() => select(i)}
						>
							<a
								class="sheet thumb"
								href={r.pdf_url}
								target="_blank"
								rel="external noopener"
								aria-label="Open page {r.page_number} of {r.document_title} (PDF)"
							>
								{#if failed.has(r.page_image_url)}
									<span class="expired">Page image expired. Search again to refresh.</span>
								{:else}
									<!-- width/height are an aspect hint only, to reserve space; the real ratio takes over on load. -->
									<img
										src={r.page_image_url}
										alt="Page {r.page_number} of {r.document_title}"
										width="935"
										height="1210"
										loading={i < 10 ? 'eager' : 'lazy'}
										decoding="async"
										onerror={() => failed.add(r.page_image_url)}
									/>
								{/if}
							</a>
							<div class="hit">
								<h3><span class="rank">{i + 1}</span>{r.document_title}</h3>
								<p class="meta">
									<span class="loc">p.{r.page_number}</span>
									{#if sourceNames.get(r.data_source_id) !== r.document_title}
										<span class="muted"
											>{sourceNames.get(r.data_source_id) ?? r.data_source_id}</span
										>
									{/if}
									<a class="loc" href={r.pdf_url} target="_blank" rel="external noopener"
										>PDF p.{r.page_number} ↗</a
									>
								</p>
								{#if r.snippet}
									<blockquote class="source">{snippetText(r.snippet)}</blockquote>
								{/if}
							</div>
						</li>
					{/each}
				</ol>

				{#if shown && wide.current}
					<figure class="viewer" aria-label="Selected page">
						<a
							class="sheet"
							href={shown.pdf_url}
							target="_blank"
							rel="external noopener"
							aria-label="Open page {shown.page_number} of {shown.document_title} (PDF)"
						>
							{#if failed.has(shown.page_image_url)}
								<span class="expired">Page image expired. Search again to refresh.</span>
							{:else}
								<!-- Aspect hint only (see above). -->
								<img
									src={shown.page_image_url}
									alt="Page {shown.page_number} of {shown.document_title}"
									width="935"
									height="1210"
									onerror={() => shown && failed.add(shown.page_image_url)}
								/>
							{/if}
						</a>
						<figcaption>
							<span class="loc">{current + 1} · {shown.document_title} · p.{shown.page_number}</span
							>
							<a class="loc" href={shown.pdf_url} target="_blank" rel="external noopener"
								>PDF p.{shown.page_number} ↗</a
							>
						</figcaption>
					</figure>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style>
	.page-head .waiting {
		margin: 0;
	}

	/* ---- Query form ---- */
	form.search {
		display: grid;
		gap: 1rem;
		max-width: 52rem;
		margin-bottom: 2rem;
	}
	.query {
		display: flex;
		gap: 0.5rem;
	}
	.query input {
		flex: 1;
		min-width: 0;
		font-size: 1.0625rem;
	}
	.query button {
		padding-inline: 1.5rem;
	}
	.scope {
		display: grid;
		gap: 0.75rem;
	}
	.scope p {
		margin: 0;
	}
	.corpora {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.5rem;
	}
	.pages {
		margin-left: 0.25rem;
		white-space: nowrap;
		font: 400 0.8125rem/1 var(--font-mono);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
	.scope legend {
		margin-bottom: 0.125rem;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0 1.5rem;
	}
	.options details > summary {
		color: var(--color-muted);
		font-weight: 400;
	}
	.option-fields {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.5rem;
		padding: 0.25rem 0 0.5rem;
	}
	.count {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.count input {
		width: 5rem;
		min-height: 2.25rem;
		padding-block: 0.375rem;
	}
	form .notice {
		margin: 0;
	}

	/* ---- Generated summary ---- */
	.summary h2 {
		margin-bottom: 0.5rem;
	}
	.summary h2 .muted {
		font-size: 0.9375rem;
		font-weight: 400;
	}
	.status {
		margin: 0 0 0.75rem;
	}
	.answer {
		max-width: 68ch;
		font-size: 1.0625rem;
		line-height: 1.6;
		white-space: pre-line;
	}
	.cite {
		font: 500 0.8125rem/1 var(--font-mono);
		font-variant-numeric: tabular-nums;
		padding: 0 0.1em;
		white-space: nowrap;
	}
	.claims {
		list-style: none;
		max-width: 68ch;
		margin: 0 0 1rem;
		padding: 0;
		border-top: 1px solid var(--color-rule);
	}
	.claims li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'flag loc' 'claim claim';
		align-items: baseline;
		gap: 0.25rem 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-rule);
		font-size: 0.9375rem;
	}
	.claims .flag {
		grid-area: flag;
	}
	.claims .claim {
		grid-area: claim;
	}
	.claims .loc {
		grid-area: loc;
		white-space: nowrap;
	}
	@media (min-width: 40rem) {
		.claims li {
			grid-template-columns: 9.5rem minmax(0, 1fr) auto;
			grid-template-areas: 'flag claim loc';
		}
	}

	/* ---- Evidence ---- */
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
	.keys {
		display: none;
		margin: 0;
		font-size: 0.8125rem;
	}
	@media (hover: hover) and (pointer: fine) {
		.keys {
			display: block;
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
	/* Phones: a small thumbnail beside each hit, not a full-width page per result. */
	.hits li {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		gap: 0.75rem 1.25rem;
		padding: 1.25rem 0;
		border-bottom: 1px solid var(--color-rule);
		scroll-margin-top: 1rem;
	}
	.hits li:focus-visible {
		outline-offset: -2px;
	}
	.hit {
		min-width: 0;
	}
	.hit h3 {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.25rem;
	}
	.rank {
		flex: none;
		min-width: 1.5rem;
		font: 500 1rem/1.2 var(--font-mono);
		font-variant-numeric: tabular-nums;
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
	.thumb {
		width: 100%;
		color: inherit;
		text-decoration: none;
	}
	.expired {
		display: block;
		padding: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-ink);
		background: var(--color-surface);
	}
	.viewer {
		margin: 0;
	}

	@media (min-width: 40rem) {
		.hits li {
			grid-template-columns: 12rem minmax(0, 1fr);
		}
		.expired {
			padding: 1rem;
			font-size: 0.875rem;
		}
	}

	/* Desktop: a narrow contact strip of pages beside the selected page at reading size. */
	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) minmax(0, 30rem);
			align-items: start;
		}
		.hits li {
			grid-template-columns: 5.5rem minmax(0, 1fr);
			padding: 1rem 0.75rem 1rem 0;
			cursor: default;
		}
		.hits li[aria-current='true'] {
			background: var(--color-surface);
			box-shadow: inset 2px 0 0 var(--color-ink);
			padding-left: 0.75rem;
		}
		.hits li:not([aria-current='true']) {
			padding-left: 0.75rem;
		}
		.expired {
			padding: 0.5rem;
			font-size: 0.75rem;
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
		.viewer .sheet img {
			width: auto;
			max-width: 100%;
			max-height: calc(100vh - 5rem);
		}
		.viewer .expired {
			padding: 1.5rem;
			font-size: 0.875rem;
		}
		figcaption {
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			gap: 0 1rem;
		}
	}
</style>
