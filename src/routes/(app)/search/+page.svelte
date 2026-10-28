<script lang="ts">
	// The trail screen (infra/docs/handovers/2026-10-28-search-trail.md, "The trail screen"): each
	// search is a numbered step with its own scope, readout and checked summary; the selected
	// step's pages fill the results view. Steps stream from POST /search/stream and are built
	// with the same reducer the server stores them with (`applyEvent`).
	import { onMount, tick } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import {
		answerMarks,
		answerSegments,
		markOutlines,
		pageOutlines,
		resultAnchorId,
		type Mark,
		type Outline
	} from '#lib/answer.js';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import StepSummary from '#lib/components/StepSummary.svelte';
	import TrailHeader from '#lib/components/TrailHeader.svelte';
	import WaitingBar from '#lib/components/WaitingBar.svelte';
	import type { Failure } from '#lib/failure.js';
	import { count, plural } from '#lib/format.js';
	import { ndjson } from '#lib/ndjson.js';
	import { isTypingTarget, locator, step as move } from '#lib/search-view.js';
	import {
		indexedDay,
		startClock,
		stepReadout,
		summaryProblem,
		tickClock,
		type WaitClock
	} from '#lib/step-view.js';
	import {
		applyEvent,
		isNarrowed,
		newStep,
		refine,
		scopeLabel,
		stepDocuments,
		stepNumber,
		widen,
		type StepRequest,
		type StepResult,
		type StreamEvent,
		type TrailStep
	} from '#lib/trail.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let all = $derived(data.groups.flatMap((g) => g.dataSources));
	let allIds = $derived(all.map((ds) => ds.id));
	let groups = $derived(data.groups.filter((g) => g.dataSources.length > 0));
	let noOrg = $derived(data.access.memberships.length === 0);
	let sourceNames = $derived(new Map(all.map((ds) => [ds.id, ds.name])));
	let contextName = $derived(
		data.access.context.kind === 'org' ? data.access.context.org.name : 'Public'
	);
	const orgName = (id: string | null) =>
		id === null
			? 'Public'
			: (data.access.memberships.find((m) => m.id === id)?.name ?? 'another org');

	// ---- The new-search form: picker and options, kept across searches. ----
	/** Unticked data sources (default: everything the user can search). */
	const unpicked = new SvelteSet<string>();
	let picked = $derived(allIds.filter((id) => !unpicked.has(id)));
	const initialQuery = () => data.query;
	let query = $state(initialQuery());
	let summaryOn = $state(true);
	let topK = $state(10);
	let rerank = $state(true);
	let refineQuery = $state('');
	let exact = $state(false);

	// ---- The trail: stored steps from `?trail=`, or the ones searched on this page. ----
	const fromData = () => ({
		steps: data.trail?.steps ?? [],
		id: data.trail?.id ?? null
	});
	let steps = $state.raw<TrailStep[]>(fromData().steps);
	let trailId = $state<string | null>(fromData().id);
	let selectedN = $state(fromData().steps.at(-1)?.n ?? 0);
	let selected = $derived(steps.find((s) => s.n === selectedN) ?? steps.at(-1) ?? null);

	// Another trail (or none) opened by navigation: show it. Shallow URL updates don't count, and
	// reloading the trail this page just stored keeps the live steps (they carry page URLs).
	afterNavigate((nav) => {
		if (nav.type === 'enter' || nav.shallow) return;
		const next = fromData();
		if (next.id === trailId || (next.id === null && trailId === null)) return;
		stop();
		steps = next.steps;
		trailId = next.id;
		selectedN = next.steps.at(-1)?.n ?? 0;
	});

	/** The stored trail as loaded, when it's the one shown: title, owner, people. */
	let stored = $derived(data.trail && data.trail.id === trailId ? data.trail : null);
	let canRefine = $derived(stored ? stored.canRefine : true);
	let title = $derived(stored?.title ?? steps[0]?.query ?? '');
	let contextNote = $derived(
		stored?.isOwner && !stored.canRefine
			? `This trail was searched in ${orgName(stored.org_id)}. Switch back to it to refine, or start a new search.`
			: null
	);
	let actionNotice = $derived(
		form && 'error' in form ? form.error : form && 'notice' in form ? form.notice : null
	);

	// ---- Streaming one step. ----
	let live = $state<{ key: string; clock: WaitClock } | null>(null);
	let now = $state(0);
	let ticker: ReturnType<typeof setInterval> | undefined;
	let controller: AbortController | null = null;
	/** A search that produced no step (refused, or failed before results), by the form it came from. */
	let problem = $state<{
		where: 'new' | 'refine';
		text: string | null;
		failure: Failure | null;
	} | null>(null);

	function stop() {
		controller?.abort();
		controller = null;
		live = null;
		clearInterval(ticker);
	}
	onMount(() => stop);

	const searchHref = () => resolve('/(app)/search');
	const trailHref = (id: string) => `${searchHref()}?trail=${id}`;

	async function run(req: StepRequest, where: 'new' | 'refine') {
		stop();
		const ac = new AbortController();
		controller = ac;
		problem = null;
		if (req.from === null) {
			steps = [];
			trailId = null;
			if (new URL(location.href).searchParams.has('trail'))
				void goto(searchHref(), { shallow: true, replace: true });
		}
		const n = Math.max(0, ...steps.map((s) => s.n)) + 1;
		const fresh = newStep(
			req,
			n,
			Object.fromEntries(all.map((ds) => [ds.id, ds.name])),
			Object.fromEntries(all.map((ds) => [ds.id, ds.indexed_at]))
		);
		const key = fresh.created_at;
		const current = () => steps.find((s) => s.created_at === key);
		const update = (f: (s: TrailStep) => TrailStep) =>
			(steps = steps.map((s) => (s.created_at === key ? f(s) : s)));
		const drop = () => (steps = steps.filter((s) => s.created_at !== key));
		steps = [...steps, fresh];
		selectedN = n;
		now = performance.now();
		live = { key, clock: startClock(now, req.answer) };
		ticker = setInterval(() => (now = performance.now()), 100);
		void tick().then(() =>
			document.querySelector(`[data-step="${key}"]`)?.scrollIntoView({ block: 'nearest' })
		);
		let newTrail: string | null = null;

		try {
			const res = await fetch(resolve('/(app)/search/stream'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(req),
				signal: ac.signal
			});
			if (!res.ok || !res.body) {
				const body = (await res.json().catch(() => null)) as {
					error?: string;
					failure?: Failure;
				} | null;
				drop();
				problem = {
					where,
					failure: body?.failure ?? null,
					text: body?.failure ? null : (body?.error ?? `The search failed (${res.status}).`)
				};
				return;
			}
			for await (const event of ndjson<StreamEvent>(res.body)) {
				if (live?.key === key)
					live = { key, clock: tickClock(live.clock, event, performance.now()) };
				if (event.type === 'stored') {
					if (selectedN === current()?.n) selectedN = event.n;
					if (trailId === null) {
						trailId = newTrail = event.trail_id;
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?trail=
						void goto(trailHref(event.trail_id), {
							shallow: true,
							replace: true
						});
					}
				}
				update((s) => applyEvent(s, event, req.from));
			}
		} catch {
			const got = current();
			if (got && got.readout.search !== null && !got.readout.finished) {
				const detail = ac.signal.aborted
					? 'The search was stopped.'
					: 'The connection to Boreal was lost.';
				update((s) => applyEvent(s, { type: 'error', status: null, detail }, req.from));
			}
		} finally {
			if (controller === ac) stop();
			// No results: nothing to keep in the trail; say why where it was asked.
			const got = current();
			if (got && got.readout.search === null) {
				drop();
				if (!ac.signal.aborted)
					problem = {
						where,
						failure: null,
						text: summaryProblem(got) ?? 'Results not available. Try again.'
					};
			}
		}
		// Load the trail just stored (owner, people to share with), keeping the steps shown.
		if (newTrail && trailId === newTrail)
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?trail=
			await goto(trailHref(newTrail), { replace: true, reset: false });
	}

	const settings = () => ({
		answer: summaryOn,
		top_k: Math.min(50, Math.max(1, Math.round(topK || 10))),
		rerank,
		trail_id: trailId
	});

	function newSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (!q || picked.length === 0) return;
		void run(
			{
				query: q,
				data_source_ids: picked,
				document_ids: null,
				document_titles: {},
				rewrite: true,
				doc_filter: true,
				from: null,
				context: [],
				...settings(),
				trail_id: null
			},
			'new'
		);
	}

	function refineSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = refineQuery.trim();
		if (!q || !selected) return;
		void run(
			{ ...refine(steps, selected.n), query: q, rewrite: !exact, doc_filter: true, ...settings() },
			'refine'
		);
		refineQuery = '';
	}

	const widenStep = (s: TrailStep) => void run({ ...widen(s), ...settings() }, 'refine');

	/** Documents across a step's data sources, for "Search all N documents"; null if unknown. */
	function documentsIn(s: TrailStep): number | null {
		let total = 0;
		for (const id of s.scope.data_source_ids) {
			const n = all.find((ds) => ds.id === id)?.documents;
			if (n === null || n === undefined) return null;
			total += n;
		}
		return total;
	}
	const canWiden = (s: TrailStep) =>
		canRefine && s.readout.finished && stepDocuments(s).ids.length > 0;

	// ---- The results view: the selected step's pages. ----
	const NONE: StepResult[] = [];
	let results = $derived(selected?.results ?? NONE);
	let answer = $derived(selected?.answer ?? null);
	let segments = $derived(answer ? answerSegments(answer, results) : []);
	let marks = $derived(answerMarks(segments));

	/** Permanent link to the PDF at the result's page; it leaves the app (`rel="external"`). */
	const pdfHref = (r: StepResult) =>
		`${resolve('/pdf/[ds]/[doc]', { ds: r.data_source_id, doc: r.document_id })}?page=${r.page_number}`;
	/** The page render: the permanent link when the server can sign, else the live step's engine URL. */
	const pageSrc = (r: StepResult): string | null =>
		data.permanentLinks
			? resolve('/pages/[ds]/[doc]/[page]', {
					ds: r.data_source_id,
					doc: r.document_id,
					page: String(r.page_number)
				})
			: (r.page_image_url ?? null);

	// The result shown large beside the list: the first result the summary cites, else the top.
	let current = $derived(marks.length > 0 ? marks[0].ref - 1 : 0);
	let shown = $derived(results[current] ?? null);
	// The large page sits beside the list only on wide screens; phones open a page under its row.
	const wide = new MediaQuery('min-width: 64rem', false);
	// Phone thumbnails become expand buttons only once JS runs; until then they stay PDF links.
	let interactive = $state(false);
	onMount(() => {
		interactive = true;
	});
	// Engine-signed URLs expire, and stored steps keep none; a missing render shows a plain line.
	const failed = new SvelteSet<string>();
	const missingText = (r: StepResult) =>
		data.permanentLinks
			? "Page image couldn't be loaded."
			: r.page_image_url
				? 'Page image expired. Search again to refresh.'
				: "Page images aren't kept with the trail. Open the PDF at this page.";
	// Space: the large page at full brightness and wider.
	let zoomed = $state(false);

	// Phones: the result whose page is open large under its row, and what opened it (focus
	// returns there on close). Closed by another step.
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
	// summary cites on it. Cleared by another step or by moving to another result.
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
	 * Show mark `m` of step `s`: open the step, select its result. Activated (`from` the link
	 * chosen): move focus there and scroll its first box into view; on phones, open its page
	 * large under the row. Focus alone only acts within the selected step.
	 */
	async function choose(s: TrailStep, m: Mark, from: HTMLElement | null) {
		if (s !== selected) {
			if (!from) return;
			selectedN = s.n;
			await tick();
		}
		select(m.ref - 1, from !== null);
		active = m;
		if (!from) return;
		if (!wide.current) return expand(m.ref - 1, from, false);
		await tick();
		document.querySelector('.viewer .mark')?.scrollIntoView({ block: 'nearest' });
	}

	function openStep(n: number) {
		selectedN = n;
		zoomed = false;
	}

	// "Citation copied", announced and shown briefly.
	let copyStatus = $state('');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyCitation(r: StepResult) {
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
				select(move(current, e.key === 'j' ? 1 : -1, results.length), true);
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
{#snippet render(r: StepResult, outlines: Outline[], lazy = false)}
	{@const src = pageSrc(r)}
	{#if src === null || failed.has(src)}
		<span class="expired">{missingText(r)}</span>
	{:else}
		<span class="frame">
			<img
				{src}
				alt="Page {r.page_number} of {r.document_title}"
				width="935"
				height="1210"
				loading={lazy ? 'lazy' : 'eager'}
				decoding="async"
				onerror={() => failed.add(src)}
			/>
			{@render outline(outlines)}
		</span>
	{/if}
{/snippet}

{#snippet searchProblem(where: 'new' | 'refine')}
	{#if problem?.where === where}
		{#if problem.failure}
			<FailureNotice failure={problem.failure} />
		{:else if problem.text}
			<p class="notice" role="status">{problem.text}</p>
		{/if}
	{/if}
{/snippet}

{#snippet widenAction(s: TrailStep)}
	{@const n = documentsIn(s)}
	<p class="widen">
		<button type="button" class="outline" onclick={() => widenStep(s)}>
			Search all {n === null ? '' : `${count(n)} `}{plural(n ?? 2, 'document')}
		</button>
	</p>
{/snippet}

<div class="page-head">
	<h1>Search</h1>
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
	<form class="search" onsubmit={newSearch}>
		<div class="query">
			<label for="query" class="sr-only">Query</label>
			<input
				id="query"
				type="search"
				name="query"
				required
				bind:value={query}
				autocomplete="off"
				placeholder={steps.length > 0 ? 'Start a new search' : 'Search documents'}
			/>
			<button type="submit" class="primary" disabled={groups.length === 0 || picked.length === 0}>
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
									checked={!unpicked.has(ds.id)}
									onchange={(e) =>
										e.currentTarget.checked ? unpicked.delete(ds.id) : unpicked.add(ds.id)}
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
				<input type="checkbox" name="answer" bind:checked={summaryOn} />
				Generated summary, each sentence checked
			</label>
			<details>
				<summary>Options</summary>
				<div class="option-fields">
					<label class="count">
						Results
						<input type="number" name="top_k" min="1" max="50" bind:value={topK} />
					</label>
					<label class="check">
						<input type="checkbox" name="rerank" bind:checked={rerank} />
						Rerank
					</label>
				</div>
			</details>
		</div>

		{@render searchProblem('new')}
	</form>

	{#if noOrg}
		<p class="muted">Want your own documents? Contact us.</p>
	{/if}
{/if}

{#if steps.length > 0}
	<section class="band trail" aria-labelledby="trail-heading">
		<TrailHeader
			{title}
			{steps}
			{stored}
			email={data.user?.email ?? ''}
			context={stored ? orgName(stored.org_id) : contextName}
			notice={actionNotice}
		/>
		{#if !data.history && canRefine}
			<p class="note">
				This org doesn't keep search history. The trail ends when you leave the page.
			</p>
		{/if}
		{#if contextNote}<p class="note">{contextNote}</p>{/if}

		<ol class="steps">
			{#each steps as s (s.created_at)}
				{@const isSelected = s === selected}
				{@const waiting = live?.key === s.created_at ? live.clock : null}
				{@const readout = stepReadout(s)}
				{@const showReadout = s.readout.search !== null && (s.readout.finished || !s.wants_answer)}
				{@const indexed = indexedDay(s)}
				<li
					class={['step', !isSelected && 'earlier']}
					data-step={s.created_at}
					aria-current={isSelected ? 'step' : undefined}
					data-step-done={s.readout.finished ? '' : undefined}
				>
					<h3>
						<button
							type="button"
							class="open"
							aria-label={isSelected ? undefined : `Open step ${stepNumber(s.n)}: ${s.query}`}
							onclick={() => openStep(s.n)}
						>
							<span class="num">{stepNumber(s.n)}</span>
							<span class="q">{s.query}</span>
						</button>
					</h3>
					{#if isNarrowed(s, allIds) || s.builds_on !== null || !s.rewrite}
						<p class="chips">
							{#if isNarrowed(s, allIds)}<span>scope: {scopeLabel(s)}</span>{/if}
							{#if s.builds_on !== null}<span>builds on {stepNumber(s.builds_on)}</span>{/if}
							{#if !s.rewrite}<span>exactly as typed</span>{/if}
						</p>
					{/if}
					{#if s.resolved_query !== s.query}
						<p class="as">Searched as: {s.resolved_query}</p>
					{/if}

					<div class="body">
						{#if waiting && (s.readout.search === null || (s.wants_answer && !s.answer))}
							<WaitingBar clock={waiting} {now} />
						{/if}
						{#if s.answer}
							<StepSummary
								step={{ ...s, answer: s.answer }}
								active={isSelected ? active : null}
								dim={!isSelected}
								onchoose={(m, from) => choose(s, m, from)}
							>
								{#if canWiden(s)}{@render widenAction(s)}{/if}
							</StepSummary>
						{/if}
						{#if s.readout.search !== null && summaryProblem(s)}
							<p class="problem">{summaryProblem(s)}</p>
						{/if}
						{#if showReadout}
							<p class="readout">
								{#each readout as r, i (i)}
									<span
										>{r.before ? `${r.before} ` : ''}<b>{r.value}</b>{r.after
											? ` ${r.after}`
											: ''}</span
									>
								{/each}
								{#if indexed}<span>indexed {indexed}</span>{/if}
							</p>
						{/if}
						{#if canWiden(s) && !s.answer?.abstained}{@render widenAction(s)}{/if}
					</div>

					{#if isSelected && canRefine}
						<form class="refine" onsubmit={refineSearch}>
							<div class="query">
								<label for="refine" class="sr-only">Refine step {stepNumber(s.n)}</label>
								<input
									id="refine"
									type="search"
									name="refine"
									bind:value={refineQuery}
									autocomplete="off"
									placeholder="Refine, or start a new search…"
								/>
								<button type="submit">Search</button>
							</div>
							<label class="check">
								<input type="checkbox" name="exact" bind:checked={exact} />
								Search exactly as typed
							</label>
							{@render searchProblem('refine')}
						</form>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{/if}

{#if selected && selected.readout.search !== null}
	<section class="band evidence" aria-labelledby="evidence-heading">
		<div class="evidence-head">
			<h2 id="evidence-heading">
				Pages <span class="loc">step {stepNumber(selected.n)}</span>
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
								<h3 class="loc"><span class="rank">{i + 1}</span>{locator(r).join(' · ')}</h3>
								<p class="meta">
									{#if sourceNames.get(r.data_source_id) !== r.document_title}
										<span class="muted"
											>{sourceNames.get(r.data_source_id) ??
												selected.scope.data_source_names[r.data_source_id] ??
												r.data_source_id}</span
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
	/* ---- Query forms ---- */
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

	/* ---- The trail ---- */
	.note {
		margin: 0 0 0.75rem;
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
	}
	.steps {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		border-top: 1px solid var(--color-rule);
	}
	.step {
		padding: 1rem 0 1.25rem;
		border-bottom: 1px solid var(--color-rule);
	}
	.step:last-child {
		border-bottom: 0;
	}
	.step h3 {
		margin: 0 0 0.25rem;
	}
	/* The step's number and query, as a heading-sized control that opens its snapshot. */
	.open {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		white-space: normal;
		cursor: pointer;
	}
	.step[aria-current] .open {
		cursor: default;
	}
	.num {
		flex: none;
		font: 500 0.9375rem/1.2 var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
	}
	.q {
		font-size: 1.125rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.earlier .q,
	.earlier .problem {
		color: var(--color-muted);
	}
	.earlier .open:hover .q {
		color: var(--color-ink);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
	}
	.chips,
	.as {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		margin: 0 0 0.25rem 2.25rem;
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
	}
	.chips span {
		padding: 0 0.375rem;
		border: 1px solid var(--color-rule);
		border-radius: 2px;
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.as {
		display: block;
		overflow-wrap: anywhere;
	}
	.body {
		margin: 0.75rem 0 0 2.25rem;
	}
	.body :global(.waiting) {
		margin-bottom: 0.75rem;
	}
	.body .readout {
		margin-top: 0.25rem;
	}
	.problem {
		margin: 0 0 0.5rem;
		color: var(--color-muted);
	}
	.widen {
		margin: 0.75rem 0 0;
	}
	/* Spruce outline: the widen action, a search, not a destructive or primary one. */
	button.outline {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}
	.refine {
		display: grid;
		gap: 0.5rem;
		max-width: 52rem;
		margin: 1.25rem 0 0 2.25rem;
	}
	.refine .query input {
		font-size: 1rem;
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
	@media (max-width: 40rem) {
		.chips,
		.as,
		.body,
		.refine {
			margin-left: 0;
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
