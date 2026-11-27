<!--
	One search for review: what was asked, what came back (the summary as the user saw it, with
	its checks, and the result locators), the rest of its trail, its ratings and this admin's own
	Good / Bad. Signed page links aren't kept, so results show locators only.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { resultAnchorId } from '#lib/answer.js';
	import Rate from '#lib/components/Rate.svelte';
	import StepSummary from '#lib/components/search/StepSummary.svelte';
	import { count, humanise, stamp } from '#lib/format.js';
	import { locator, seconds, snippetText } from '#lib/search-view.js';
	import AdminNav from '../../AdminNav.svelte';
	import RatingMark from '../RatingMark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let s = $derived(data.search);
	let step = $derived(data.step);
	let ms = $derived(s.total_ms);
	const show = (i: number | null) => {
		if (i !== null)
			document.getElementById(resultAnchorId(i + 1))?.scrollIntoView({ block: 'center' });
	};
</script>

<svelte:head>
	<title>Search · Platform admin · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<AdminNav />
	<p><a href={resolve('/(site)/admin/searches')}>All searches</a></p>
	<h1>{s.query ?? `Query not kept (${count(s.query_length)} characters)`}</h1>
	{#if s.resolved_query && s.resolved_query !== s.query}
		<p class="muted">Searched as: {s.resolved_query}</p>
	{/if}
</div>

<dl class="facts">
	<dt>Time</dt>
	<dd class="mono"><time datetime={s.created_at}>{stamp(s.created_at)}</time></dd>
	<dt>User</dt>
	<dd>{s.user_email ?? 'Deleted user'}</dd>
	<dt>Context</dt>
	<dd>{s.org_id ? (s.org_name ?? 'Deleted org') : 'Public'}</dd>
	<dt>Data sources</dt>
	<dd class="mono">{s.data_source_ids.join(', ')}</dd>
	<dt>Outcome</dt>
	<dd class="mono">
		{[
			humanise(s.status),
			...(s.result_count === null ? [] : [`${count(s.result_count)} results`]),
			...(ms === null ? [] : [`${seconds(ms)} s`])
		].join(' · ')}
		{#if s.error}<span class="error">{s.error}</span>{/if}
	</dd>
	<dt>Engine</dt>
	<dd class="mono">{s.engine_version ?? 'Not reported'}</dd>
	<dt>Ratings</dt>
	<dd>
		{#if !s.rating && !s.trail_rating}<span class="muted">None</span>{/if}
		<RatingMark who="Response{s.rated_by ? ` (${s.rated_by})` : ''}" rating={s.rating} />
		{#if s.note}<p class="note">“{s.note}”</p>{/if}
		<RatingMark who="Whole trail" rating={s.trail_rating} />
		{#if s.trail_note}<p class="note">“{s.trail_note}”</p>{/if}
	</dd>
</dl>

{#if data.mine}
	<Rate target={{ kind: 'search', id: s.id }} initial={data.mine.value} label="Your rating" />
{/if}

{#if data.conversation.length > 1}
	<section class="band" aria-labelledby="trail-h">
		<h2 id="trail-h">In its trail</h2>
		<ol class="trail">
			{#each data.conversation as c (c.id)}
				<li aria-current={c.id === s.id ? 'step' : undefined}>
					<span class="mono muted">{String(c.step_n ?? 0).padStart(2, '0')}</span>
					{#if c.id === s.id}
						<b>{c.query ?? 'Query not kept'}</b>
					{:else}
						<a href={resolve('/(site)/admin/searches/[id]', { id: c.id })}
							>{c.query ?? 'Query not kept'}</a
						>
					{/if}
					<RatingMark who="Rating" rating={c.rating} />
				</li>
			{/each}
		</ol>
	</section>
{/if}

<section class="band" aria-labelledby="answer-h">
	<h2 id="answer-h">Response</h2>
	{#if step.answer}
		<StepSummary step={{ ...step, answer: step.answer }} onchoose={(m) => show(m.result)} />
	{:else if s.query === null}
		<p class="empty">Not kept: this org doesn't log queries.</p>
	{:else}
		<p class="empty">No summary{s.status === 'ok' ? '' : ': the search did not finish'}.</p>
	{/if}

	{#if step.results.length > 0}
		<h3>Results</h3>
		<ol class="results">
			{#each step.results as r, i (i)}
				<li id={resultAnchorId(i + 1)}>
					<span class="mono rank">{i + 1}</span>
					<div>
						<p class="loc">{locator(r).join(' · ')}</p>
						{#if r.snippet}<p class="source">{snippetText(r.snippet)}</p>{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.375rem 1.25rem;
		margin: 0 0 1rem;
	}
	.facts dt {
		color: var(--color-muted);
	}
	.facts dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}
	.error {
		display: block;
		color: var(--color-muted);
	}
	.note {
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}
	.band {
		margin-top: 1.5rem;
	}
	.trail,
	.results {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.trail li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.75rem;
		padding: 0.375rem 0;
		border-bottom: 1px solid var(--color-rule);
	}
	.results li {
		display: grid;
		grid-template-columns: 2rem 1fr;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--color-rule);
		scroll-margin-top: 4rem;
	}
	.results p {
		margin: 0;
	}
	.results .source {
		margin-top: 0.25rem;
	}
	@media (max-width: 30rem) {
		.facts {
			grid-template-columns: 1fr;
		}
		.facts dd {
			margin-bottom: 0.5rem;
		}
	}
</style>
