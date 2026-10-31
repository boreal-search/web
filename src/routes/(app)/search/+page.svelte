<script lang="ts">
	// The trail screen (infra/docs/handovers/2026-10-28-search-trail.md, "The trail screen"): each
	// search is a numbered step with its own scope, readout and checked summary; the selected
	// step's pages fill the results view. One composer: a new search on an empty trail, else a
	// follow-up from the latest step. Streaming lives in `LiveTrail`, the results view's state in
	// `Evidence`; this page wires them to the composer.
	import { afterNavigate } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import Composer from '#lib/components/search/Composer.svelte';
	import { glide, spot, type ComposerSpot } from '#lib/components/search/composer-glide.js';
	import EvidencePane from '#lib/components/search/EvidencePane.svelte';
	import EvidencePanes, { type EvidenceClose } from '#lib/components/search/EvidencePanes.svelte';
	import { Evidence } from '#lib/components/search/evidence.svelte.js';
	import { LiveTrail } from '#lib/components/search/live-trail.svelte.js';
	import SearchOptions from '#lib/components/search/SearchOptions.svelte';
	import SearchProblem from '#lib/components/search/SearchProblem.svelte';
	import Step from '#lib/components/search/Step.svelte';
	import TrailHeader from '#lib/components/search/TrailHeader.svelte';
	import { DEFAULT_TOP_K } from '#lib/search-options.js';
	import { documentsIn, topKValue } from '#lib/search-view.js';
	import {
		followUp,
		stepDocuments,
		stepNumber,
		widen,
		type StepRequest,
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

	// ---- The composer and Search options, kept across searches. ----
	/** Unticked data sources (default: everything; a shown trail: its latest step's). */
	const unpicked = new SvelteSet<string>();
	function pickFrom(steps: readonly TrailStep[]) {
		const latest = steps.at(-1);
		if (!latest) return;
		unpicked.clear();
		for (const id of allIds) if (!latest.scope.data_source_ids.includes(id)) unpicked.add(id);
	}
	let picked = $derived(allIds.filter((id) => !unpicked.has(id)));
	const initialQuery = () => data.query;
	let query = $state(initialQuery());
	let summaryOn = $state(true);
	let topK = $state(DEFAULT_TOP_K);
	let rerank = $state(true);
	let exact = $state(false);
	let optionsOpen = $state(false);

	// ---- The trail: stored steps from `?trail=`, or the ones searched on this page. ----
	const fromData = () => ({ steps: data.trail?.steps ?? [], id: data.trail?.id ?? null });
	const trail = new LiveTrail(fromData().steps, fromData().id);
	pickFrom(fromData().steps);
	const ev = new Evidence(
		() => trail.selected,
		(n) => (trail.selectedN = n)
	);
	onMount(() => trail.stop);

	// Another trail (or none) opened by navigation: show it. Shallow URL updates don't count, and
	// reloading the trail this page just stored keeps the live steps (they carry page URLs).
	afterNavigate((nav) => {
		if (nav.type === 'enter' || nav.shallow) return;
		const next = fromData();
		// A link to the bare page ("New search") also clears a trail that was never stored.
		if (next.id === trail.trailId && !(next.id === null && nav.type === 'link')) return;
		trail.show(next.steps, next.id);
		pickFrom(next.steps);
	});

	// An empty trail centres the composer; the first step pins it under the steps (and back).
	let fresh = $derived(trail.steps.length === 0);
	let movedFrom: ComposerSpot | null = null;
	$effect.pre(() => {
		void fresh;
		movedFrom = untrack(spot);
	});
	$effect(() => {
		void fresh;
		const from = movedFrom;
		movedFrom = null;
		if (from) untrack(() => glide(from));
	});

	/** The stored trail as loaded, when it's the one shown: title, owner, people. */
	let stored = $derived(data.trail && data.trail.id === trail.trailId ? data.trail : null);
	let canRefine = $derived(stored ? stored.canRefine : true);
	/** The composer continues the trail shown (else it starts a new one). */
	let continuing = $derived(canRefine && trail.steps.length > 0);
	let orgId = $derived(data.access.context.kind === 'org' ? data.access.context.org.id : null);
	let title = $derived(stored?.title ?? trail.steps[0]?.query ?? '');
	let contextNote = $derived(
		stored?.isOwner && !stored.canRefine
			? `This trail was searched in ${orgName(stored.org_id)}. ${data.access.contexts.length > 1 ? 'Switch back to it to refine, or start a new search.' : 'Start a new search to search again.'}`
			: null
	);
	let actionNotice = $derived(
		form && 'error' in form ? form.error : form && 'notice' in form ? form.notice : null
	);

	const run = (req: StepRequest) => void trail.run(req, all);
	const settings = () => ({
		answer: summaryOn,
		top_k: topKValue(topK),
		rerank,
		trail_id: trail.trailId
	});

	function search(e: SubmitEvent) {
		e.preventDefault();
		optionsOpen = false;
		const q = query.trim();
		if (!q || picked.length === 0) return;
		const next = continuing ? followUp(trail.steps, picked) : null;
		run(
			next
				? { ...next, query: q, rewrite: !exact, doc_filter: true, ...settings() }
				: {
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
					}
		);
		query = '';
	}

	const canWiden = (s: TrailStep) =>
		canRefine && s.readout.finished && stepDocuments(s).ids.length > 0;
	/** "Branch from here": steps before the stored trail's latest, in its context, where history is kept. */
	const branchFrom = (s: TrailStep) =>
		stored &&
		data.history &&
		stored.org_id === orgId &&
		!trail.live &&
		s.n < (stored.steps.at(-1)?.n ?? 0)
			? stored.id
			: null;

	function openStep(n: number) {
		trail.selectedN = n;
		ev.zoomed = false;
	}
</script>

{#snippet head()}
	<div class="page-head"><h1>Search</h1></div>
{/snippet}

{#snippet composer()}
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
		<Composer
			bind:value={query}
			label={continuing ? 'Follow-up query' : 'Query'}
			placeholder={continuing
				? `Follow up on step ${stepNumber(trail.steps.at(-1)?.n ?? 1)}…`
				: trail.steps.length > 0
					? 'Start a new search'
					: 'Search documents'}
			disabled={groups.length === 0 || picked.length === 0}
			onsubmit={search}
			onengage={() => (optionsOpen = false)}
		>
			<SearchOptions
				{groups}
				{unpicked}
				bind:summaryOn
				bind:topK
				bind:rerank
				bind:exact
				bind:open={optionsOpen}
				followUp={continuing}
			/>
			<SearchProblem problem={trail.problem} />
		</Composer>
		{#if noOrg}
			<p class="muted">Want your own documents? Contact us.</p>
		{/if}
	{/if}
{/snippet}

{#snippet evidence(close: EvidenceClose)}
	<EvidencePane
		step={trail.selected}
		{ev}
		{sourceNames}
		permanentLinks={data.permanentLinks}
		{close}
	/>
{/snippet}

{#if fresh}
	<div class="start">{@render head()}{@render composer()}</div>
{:else}
	{@render head()}
	<EvidencePanes selectedKey={trail.selected?.created_at} split={data.split} {composer} {evidence}>
		{#snippet steps({ beside, open })}
			<section class="trail" aria-labelledby="trail-heading">
				<TrailHeader
					{title}
					steps={trail.steps}
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
					{#each trail.steps as s (s.created_at)}
						<Step
							step={s}
							selected={s === trail.selected}
							waiting={trail.live?.key === s.created_at ? trail.live.clock : null}
							now={trail.now}
							{allIds}
							active={ev.active}
							canWiden={canWiden(s)}
							documents={documentsIn(s.scope.data_source_ids, all)}
							onselect={() => openStep(s.n)}
							onchoose={async (m, from) => {
								if (from) await open();
								ev.choose(s, m, from);
							}}
							onwiden={() => run({ ...widen(s), ...settings() })}
							onview={beside
								? undefined
								: () => {
										openStep(s.n);
										void open();
									}}
							branchFrom={branchFrom(s)}
						/>
					{/each}
				</ol>
			</section>
		{/snippet}
	</EvidencePanes>
{/if}

<style>
	/* Phones: the bar above it (Trails, New search) heads the screen; screen readers keep the h1. */
	@media (max-width: 47.5rem) {
		.page-head {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: 0;
			overflow: hidden;
			clip-path: inset(50%);
		}
	}
	/* A new search: the composer (and Search options, opening below it) in the middle of the area. */
	.start {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.75rem;
		min-height: max(16rem, calc(100dvh - var(--site-footer) - 16rem));
		padding-bottom: 4rem;
	}
	.start > :global(*) {
		width: 100%;
		max-width: 52rem;
		margin-inline: auto;
	}
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
	/* The selected step, the one whose pages the evidence shows, carries a bar on its edge. */
	.steps :global(.step) {
		padding-left: 0.75rem;
		scroll-margin-top: 1rem;
	}
	.steps :global(.step[aria-current]) {
		box-shadow: inset 2px 0 0 var(--color-ink);
	}
</style>
