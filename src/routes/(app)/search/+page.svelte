<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import {
		answerCheck,
		answerCheckLabel,
		answerMarks,
		answerSegments,
		claimMark,
		markOutlines,
		pageOutlines,
		resultAnchorId,
		type Mark,
		type Outline
	} from '#lib/answer.js';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
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
	let segments = $derived(answer ? answerSegments(answer, results) : []);
	let marks = $derived(answerMarks(segments));
	let check = $derived(answer ? answerCheck(answer) : null);
	let claims = $derived(check?.state === 'checked' ? check.claims : []);
	let summaryPages = $derived(new Set(answer?.sources.map((s) => s.ref) ?? []).size);

	let pdfCount = $derived(new Set(results.map((r) => r.document_id)).size);
	let searchedPages = $derived(
		pagesSearched(
			(form?.requested ?? []).map((id) => all.find((ds) => ds.id === id)?.pages ?? null)
		)
	);

	type Hit = (typeof results)[number];
	/** Permanent link to the PDF at the result's page; it leaves the app (`rel="external"`). */
	const pdfHref = (r: Hit) =>
		`${resolve('/pdf/[ds]/[doc]', { ds: r.data_source_id, doc: r.document_id })}?page=${r.page_number}`;
	/** The page render: the permanent link when the server can sign, else the engine's URL. */
	const pageSrc = (r: Hit) =>
		data.permanentLinks
			? resolve('/pages/[ds]/[doc]/[page]', {
					ds: r.data_source_id,
					doc: r.document_id,
					page: String(r.page_number)
				})
			: r.page_image_url;

	// The result shown large beside the list: on every new search, the first result the answer
	// cites, else the top result.
	let current = $derived(marks.length > 0 ? marks[0].ref - 1 : 0);
	let shown = $derived(results[current] ?? null);
	// The large page sits beside the list only on wide screens; phones open a page under its row.
	const wide = new MediaQuery('min-width: 64rem', false);
	// Phone thumbnails become expand buttons only once JS runs; until then they stay PDF links.
	let interactive = $state(false);
	onMount(() => {
		interactive = true;
	});
	// Engine-signed URLs expire; a render that fails to load shows a plain line instead.
	const failed = new SvelteSet<string>();
	let failedText = $derived(
		data.permanentLinks
			? "Page image couldn't be loaded."
			: 'Page image expired. Search again to refresh.'
	);
	// Space: the large page at full brightness and wider.
	let zoomed = $state(false);

	// Phones: the result whose page is open large under its row, and what opened it (focus
	// returns there on close). Closed by a new search.
	let expanded = $derived.by<number | null>(() => {
		void results;
		return null;
	});
	let opener: HTMLElement | null = null;

	async function expand(i: number, from: HTMLElement | null, toggle = true) {
		if (toggle && expanded === i) return collapse();
		expanded = i;
		opener = from;
		await tick();
		const panel = document.getElementById(`page-${i + 1}`);
		(panel?.querySelector('.mark') ?? panel)?.scrollIntoView({ block: 'nearest' });
	}

	function collapse() {
		expanded = null;
		opener?.focus();
		opener = null;
	}

	// The `[n]` last chosen. Its page shows only its boxes; any other page shows every box the
	// answer cites on it. Cleared by a new search or by moving to another result.
	let active = $derived.by<Mark | null>(() => {
		void results;
		return null;
	});
	const boxesOn = (ref: number) =>
		active?.ref === ref ? markOutlines(active) : pageOutlines(marks, ref);
	let shownBoxes = $derived(boxesOn(current + 1));

	function select(i: number, focus = false) {
		current = i;
		if (active && active.ref !== i + 1) active = null;
		if (!focus) return;
		const el = document.getElementById(resultAnchorId(i + 1));
		el?.focus({ preventScroll: true });
		el?.scrollIntoView({ block: 'nearest' });
	}

	/**
	 * Show mark `m`: select its result. Activated (`from` the link chosen): move focus there and
	 * scroll its first box into view; on phones, open its page large under the row.
	 */
	async function choose(m: Mark, from: HTMLElement | null = null) {
		select(m.ref - 1, from !== null);
		active = m;
		if (!from) return;
		if (!wide.current) return expand(m.ref - 1, from, false);
		await tick();
		document.querySelector('.viewer .mark')?.scrollIntoView({ block: 'nearest' });
	}

	const markLabel = (m: Mark) =>
		`Result ${m.ref}, page ${results[m.ref - 1]?.page_number}` +
		(m.boxes.length > 0 ? ', cited text outlined' : '');

	// "Citation copied", announced and shown briefly.
	let copyStatus = $state('');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyCitation(r: Hit) {
		const link = new URL(pdfHref(r), location.href);
		try {
			await navigator.clipboard.writeText(`${r.document_title} · p.${r.page_number} · ${link}`);
			copyStatus = 'Citation copied';
		} catch {
			copyStatus = "Couldn't copy the citation";
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyStatus = ''), 2500);
	}

	/** Space activates buttons and toggles details: leave it to them. */
	const usesSpace = (t: EventTarget | null) =>
		t instanceof HTMLElement && ['BUTTON', 'SUMMARY'].includes(t.tagName);

	function onkeydown(e: KeyboardEvent) {
		if (results.length === 0 || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target))
			return;
		const r = results[current];
		switch (e.key) {
			case 'j':
			case 'k':
				e.preventDefault();
				select(step(current, e.key === 'j' ? 1 : -1, results.length), true);
				return;
			case 'o':
				e.preventDefault();
				window.open(new URL(pdfHref(r), location.href), '_blank', 'noopener');
				return;
			case 'c':
				e.preventDefault();
				copyCitation(r);
				return;
			case ' ':
				if (usesSpace(e.target)) return;
				e.preventDefault();
				if (wide.current) zoomed = !zoomed;
				else expand(current, document.getElementById(resultAnchorId(current + 1)));
				return;
			case 'Escape':
				if (expanded === null) return;
				e.preventDefault();
				collapse();
		}
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

<!-- Cited text on a page render: page fractions as percentages of the frame (.sheet). -->
{#snippet outline(outlines: Outline[])}
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
{/snippet}

<!-- A page render with its outlines; width/height are an aspect hint only, to reserve space. -->
{#snippet render(r: Hit, outlines: Outline[], lazy = false)}
	{#if failed.has(pageSrc(r))}
		<span class="expired">{failedText}</span>
	{:else}
		<span class="frame">
			<img
				src={pageSrc(r)}
				alt="Page {r.page_number} of {r.document_title}"
				width="935"
				height="1210"
				loading={lazy ? 'lazy' : 'eager'}
				decoding="async"
				onerror={() => failed.add(pageSrc(r))}
			/>
			{@render outline(outlines)}
		</span>
	{/if}
{/snippet}

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
	{#if data.engineFailure}
		<FailureNotice
			failure={data.engineFailure}
			effect="Data source names and page counts can't be loaded."
		/>
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

		{#if form && 'failure' in form && form.failure}
			<FailureNotice failure={form.failure} />
		{:else if form?.error}
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
					{@const one = seg.marks.length === 1}
					<span class="cite"
						>{#if !one}[{/if}{#each seg.marks as m, j (m.ref)}{#if j > 0},
							{/if}<a
								href="#{resultAnchorId(m.ref)}"
								class={{ on: active === m }}
								aria-label={markLabel(m)}
								onfocus={() => choose(m)}
								onclick={(e) => choose(m, e.currentTarget)}>{one ? `[${m.ref}]` : m.ref}</a
							>{/each}{#if !one}]{/if}</span
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
					{@const cm = claimMark(c, marks)}
					<li>
						<span class="flag" data-state={c.state}>
							{c.state === 'verified' ? 'Verified' : 'Unsupported'}
						</span>
						<span class="claim">{c.text}</span>
						{#if c.ref !== null && r}
							{@const ref = c.ref}
							<!-- No box for this claim: say so, and open its page unmarked. -->
							<a
								class="loc"
								href="#{resultAnchorId(ref)}"
								onclick={(e) =>
									choose(
										cm ?? {
											ref,
											kind: 'page',
											boxes: [],
											quote: null,
											text: c.text,
											status: c.state
										},
										e.currentTarget
									)}>[{ref}] p.{r.page_number}{cm?.boxes.length ? '' : ' · page'}</a
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
			<div class={['layout', zoomed && 'zoomed']}>
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
							{#if wide.current || !interactive}
								<a
									class="sheet thumb"
									href={pdfHref(r)}
									target="_blank"
									rel="external noopener"
									aria-label="Open page {r.page_number} of {r.document_title} (PDF)"
								>
									{@render render(r, boxesOn(i + 1), i >= 10)}
								</a>
							{:else}
								<button
									type="button"
									class="sheet thumb"
									aria-expanded={expanded === i}
									aria-controls="page-{i + 1}"
									aria-label="Show page {r.page_number} of {r.document_title} large"
									onclick={(e) => expand(i, e.currentTarget)}
								>
									{@render render(r, boxesOn(i + 1), i >= 10)}
								</button>
							{/if}
							<div class="hit">
								<h3><span class="rank">{i + 1}</span>{r.document_title}</h3>
								<p class="meta">
									<span class="loc">p.{r.page_number}</span>
									{#if sourceNames.get(r.data_source_id) !== r.document_title}
										<span class="muted"
											>{sourceNames.get(r.data_source_id) ?? r.data_source_id}</span
										>
									{/if}
									<a class="loc" href={pdfHref(r)} target="_blank" rel="external noopener"
										>PDF p.{r.page_number} ↗</a
									>
								</p>
								{#if r.snippet}
									<blockquote class="source">{snippetText(r.snippet)}</blockquote>
								{/if}
							</div>
							{#if expanded === i && !wide.current}
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
										<button type="button" class="quiet" onclick={collapse}>Close</button>
									</figcaption>
									<div class="sheet zoomed">{@render render(r, boxesOn(i + 1))}</div>
									{#if active?.ref === i + 1 && active.quote}
										<p class="sr-only">Outlined on the page: {active.quote}</p>
									{/if}
								</figure>
							{/if}
						</li>
					{/each}
				</ol>

				{#if shown && wide.current}
					<figure class="viewer" aria-label="Selected page">
						<a
							class={['sheet', zoomed && 'zoomed']}
							href={pdfHref(shown)}
							target="_blank"
							rel="external noopener"
							aria-label="Open page {shown.page_number} of {shown.document_title} (PDF)"
						>
							{@render render(shown, shownBoxes)}
						</a>
						<figcaption>
							<span class="loc">{current + 1} · {shown.document_title} · p.{shown.page_number}</span
							>
							{#if active?.ref === current + 1 && active.quote}
								<span class="sr-only">Outlined on the page: {active.quote}</span>
							{/if}
							<button
								type="button"
								class="quiet zoom"
								aria-pressed={zoomed}
								onclick={() => (zoomed = !zoomed)}>Zoom</button
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

<p class="copied readout" role="status">{copyStatus}</p>

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
	.cite a.on {
		background: var(--color-highlight);
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
		/* Zoomed: the selected page takes most of the width, at full size. */
		.layout.zoomed {
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		}
		.layout.zoomed .viewer {
			position: static;
		}
		.layout.zoomed .viewer .sheet img {
			max-height: none;
		}
		.viewer .expired {
			padding: 1.5rem;
			font-size: 0.875rem;
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
