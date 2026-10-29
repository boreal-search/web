<script lang="ts">
	// The trail screen (infra/docs/handovers/2026-10-28-search-trail.md, "The trail screen"): each
	// search is a numbered step with its own scope, readout and checked summary; the selected
	// step's pages fill the results view. Streaming lives in `LiveTrail`, the results view's
	// state in `Evidence`; this page wires them to the forms.
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import Composer from '#lib/components/search/Composer.svelte';
	import EvidencePane from '#lib/components/search/EvidencePane.svelte';
	import { Evidence } from '#lib/components/search/evidence.svelte.js';
	import { LiveTrail, type SearchWhere } from '#lib/components/search/live-trail.svelte.js';
	import SearchOptions from '#lib/components/search/SearchOptions.svelte';
	import SearchProblem from '#lib/components/search/SearchProblem.svelte';
	import Step from '#lib/components/search/Step.svelte';
	import TrailHeader from '#lib/components/search/TrailHeader.svelte';
	import { documentsIn, topKValue } from '#lib/search-view.js';
	import {
		refine,
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
	const fromData = () => ({ steps: data.trail?.steps ?? [], id: data.trail?.id ?? null });
	const trail = new LiveTrail(fromData().steps, fromData().id);
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
		if (next.id === trail.trailId || (next.id === null && trail.trailId === null)) return;
		trail.show(next.steps, next.id);
	});

	/** The stored trail as loaded, when it's the one shown: title, owner, people. */
	let stored = $derived(data.trail && data.trail.id === trail.trailId ? data.trail : null);
	let canRefine = $derived(stored ? stored.canRefine : true);
	let title = $derived(stored?.title ?? trail.steps[0]?.query ?? '');
	let contextNote = $derived(
		stored?.isOwner && !stored.canRefine
			? `This trail was searched in ${orgName(stored.org_id)}. Switch back to it to refine, or start a new search.`
			: null
	);
	let actionNotice = $derived(
		form && 'error' in form ? form.error : form && 'notice' in form ? form.notice : null
	);

	const run = (req: StepRequest, where: SearchWhere) => void trail.run(req, where, all);
	const settings = () => ({
		answer: summaryOn,
		top_k: topKValue(topK),
		rerank,
		trail_id: trail.trailId
	});

	function newSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (!q || picked.length === 0) return;
		run(
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
		const selected = trail.selected;
		if (!q || !selected) return;
		run(
			{
				...refine(trail.steps, selected.n),
				query: q,
				rewrite: !exact,
				doc_filter: true,
				...settings()
			},
			'refine'
		);
		refineQuery = '';
	}

	const canWiden = (s: TrailStep) =>
		canRefine && s.readout.finished && stepDocuments(s).ids.length > 0;

	function openStep(n: number) {
		trail.selectedN = n;
		ev.zoomed = false;
	}
</script>

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
	<Composer
		variant="new"
		bind:value={query}
		label="Query"
		placeholder={trail.steps.length > 0 ? 'Start a new search' : 'Search documents'}
		disabled={groups.length === 0 || picked.length === 0}
		onsubmit={newSearch}
	>
		<SearchOptions {groups} {unpicked} bind:summaryOn bind:topK bind:rerank />
		<SearchProblem problem={trail.problem?.where === 'new' ? trail.problem : null} />
	</Composer>

	{#if noOrg}
		<p class="muted">Want your own documents? Contact us.</p>
	{/if}
{/if}

{#if trail.steps.length > 0}
	<section class="band trail" aria-labelledby="trail-heading">
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
					onopen={() => openStep(s.n)}
					onchoose={(m, from) => ev.choose(s, m, from)}
					onwiden={() => run({ ...widen(s), ...settings() }, 'refine')}
				>
					{#if canRefine}
						<Composer
							variant="refine"
							bind:value={refineQuery}
							label="Refine step {stepNumber(s.n)}"
							placeholder="Refine, or start a new search…"
							onsubmit={refineSearch}
						>
							<label class="check">
								<input type="checkbox" name="exact" bind:checked={exact} />
								Search exactly as typed
							</label>
							<SearchProblem problem={trail.problem?.where === 'refine' ? trail.problem : null} />
						</Composer>
					{/if}
				</Step>
			{/each}
		</ol>
	</section>
{/if}

<EvidencePane step={trail.selected} {ev} {sourceNames} permanentLinks={data.permanentLinks} />

<style>
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
</style>
