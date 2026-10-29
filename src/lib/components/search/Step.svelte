<!--
	One trail step: its number and query (a control that opens its snapshot), scope chips, the
	query as searched, the waiting bar, the checked summary, the readout, the widen action and,
	on earlier steps of a stored trail, "Branch from here" (a new trail seeded with 01..this one).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Mark } from '#lib/answer.js';
	import { count, plural } from '#lib/format.js';
	import { indexedDay, stepReadout, summaryProblem, type WaitClock } from '#lib/step-view.js';
	import { isNarrowed, scopeLabel, stepNumber, type TrailStep } from '#lib/trail.js';
	import StepSummary from './StepSummary.svelte';
	import WaitingBar from './WaitingBar.svelte';

	let {
		step: s,
		selected,
		waiting,
		now,
		allIds,
		active,
		canWiden,
		documents,
		onopen,
		onchoose,
		onwiden,
		onview,
		branchFrom
	}: {
		step: TrailStep;
		selected: boolean;
		/** The waiting clock while this step streams. */
		waiting: WaitClock | null;
		now: number;
		/** Every data source the user can search: a step over fewer is narrowed. */
		allIds: readonly string[];
		/** The `[n]` last chosen in the results view. */
		active: Mark | null;
		canWiden: boolean;
		/** Documents across the step's data sources, for "Search all N documents"; null if unknown. */
		documents: number | null;
		onopen: () => void;
		onchoose: (m: Mark, from: HTMLElement | null) => void;
		onwiden: () => void;
		/** When given (narrow screens), a "View pages (N)" button that opens the evidence. */
		onview?: () => void;
		/** The stored trail this step can be branched from (an earlier step); null: no branch. */
		branchFrom: string | null;
	} = $props();

	let branching = $state(false);

	let readout = $derived(stepReadout(s));
	let showReadout = $derived(s.readout.search !== null && (s.readout.finished || !s.wants_answer));
	let indexed = $derived(indexedDay(s));
	let narrowed = $derived(isNarrowed(s, allIds));
	let problem = $derived(s.readout.search !== null ? summaryProblem(s) : null);
</script>

{#snippet widenAction()}
	<p class="widen">
		<button type="button" class="outline" onclick={onwiden}>
			Search all {documents === null ? '' : `${count(documents)} `}{plural(
				documents ?? 2,
				'document'
			)}
		</button>
	</p>
{/snippet}

<li
	class={['step', !selected && 'earlier']}
	data-step={s.created_at}
	aria-current={selected ? 'step' : undefined}
	data-step-done={s.readout.finished ? '' : undefined}
>
	<h3>
		<button
			type="button"
			class="open"
			aria-label={selected ? undefined : `Open step ${stepNumber(s.n)}: ${s.query}`}
			onclick={onopen}
		>
			<span class="num">{stepNumber(s.n)}</span>
			<span class="q">{s.query}</span>
		</button>
	</h3>
	{#if narrowed || s.builds_on !== null || !s.rewrite}
		<p class="chips">
			{#if narrowed}<span>scope: {scopeLabel(s)}</span>{/if}
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
				active={selected ? active : null}
				dim={!selected}
				{onchoose}
			>
				{#if canWiden}{@render widenAction()}{/if}
			</StepSummary>
		{/if}
		{#if problem}
			<p class="problem">{problem}</p>
		{/if}
		{#if showReadout}
			<p class="readout">
				{#each readout as r, i (i)}
					<span>{r.before ? `${r.before} ` : ''}<b>{r.value}</b>{r.after ? ` ${r.after}` : ''}</span
					>
				{/each}
				{#if indexed}<span>indexed {indexed}</span>{/if}
			</p>
		{/if}
		{#if canWiden && !s.answer?.abstained}{@render widenAction()}{/if}
		{#if onview && s.readout.search !== null && s.results.length > 0}
			<p class="view">
				<button type="button" onclick={onview}>View pages ({s.results.length})</button>
			</p>
		{/if}
	</div>

	{#if branchFrom}
		<form
			method="POST"
			action="?/branch"
			class="branch"
			use:enhance={() => {
				branching = true;
				return async ({ update }) => {
					await update();
					branching = false;
				};
			}}
		>
			<input type="hidden" name="trail_id" value={branchFrom} />
			<input type="hidden" name="n" value={s.n} />
			<button
				type="submit"
				class="quiet"
				disabled={branching}
				aria-label="Branch from step {stepNumber(s.n)}: a new trail with steps 01 to {stepNumber(
					s.n
				)}"
			>
				{branching ? 'Branching…' : 'Branch from here'}
			</button>
		</form>
	{/if}
</li>

<style>
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
	.widen,
	.view {
		margin: 0.75rem 0 0;
	}
	/* Spruce outline: the widen action, a search, not a destructive or primary one. */
	button.outline {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.branch {
		margin: 0.5rem 0 0 2.25rem;
	}
	.branch button {
		min-height: 2rem;
		padding-inline: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.branch button:hover {
		color: var(--color-ink);
	}

	@media (max-width: 40rem) {
		.chips,
		.as,
		.body,
		.branch {
			margin-left: 0;
		}
	}
</style>
