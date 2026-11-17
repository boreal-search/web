<script lang="ts">
	import { resolve } from '$app/paths';
	import { count, humanise, plural, stamp } from '#lib/format.js';
	import { RATING_LABELS, RATINGS } from '#lib/rating.js';
	import { seconds } from '#lib/search-view.js';
	import AdminNav from '../AdminNav.svelte';
	import RatingMark from './RatingMark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const here = resolve('/(app)/admin/searches');
	let w = $derived(data.window);
	let q = $derived(data.query);
	let orgValue = $derived(q.org?.kind === 'org' ? q.org.id : (q.org?.kind ?? ''));
</script>

<svelte:head>
	<title>Searches · Platform admin · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<AdminNav />
	<h1>Searches</h1>
	<p class="readout">
		{#if w.first > 0}
			<span
				>Showing <b>{w.first === w.last ? count(w.first) : `${count(w.first)}–${count(w.last)}`}</b>
				of <b>{count(data.total)}</b>
				{plural(data.total, 'search', 'searches')}</span
			>
		{:else}
			<span><b>{count(data.total)}</b> {plural(data.total, 'search', 'searches')}</span>
		{/if}
		<span>newest first</span>
	</p>
</div>

<form method="GET" action={here} role="search" class="filters">
	<label>
		<span>Query contains</span>
		<input type="search" name="q" value={q.q} autocomplete="off" spellcheck="false" />
	</label>
	<label>
		<span>Outcome</span>
		<select name="status" value={q.status ?? ''}>
			<option value="">Any</option>
			{#each data.outcomes as o (o)}<option value={o}>{humanise(o)}</option>{/each}
		</select>
	</label>
	<label>
		<span>User's rating</span>
		<select name="rating" value={q.rating ?? ''}>
			<option value="">Any</option>
			{#each RATINGS as r (r)}<option value={r}>{RATING_LABELS[r]}</option>{/each}
			<option value="none">Not rated</option>
		</select>
	</label>
	<label>
		<span>Review</span>
		<select name="verdict" value={q.verdict ?? ''}>
			<option value="">Any</option>
			{#each RATINGS as r (r)}<option value={r}>{RATING_LABELS[r]}</option>{/each}
			<option value="none">Not reviewed</option>
		</select>
	</label>
	<label>
		<span>Context</span>
		<select name="org" value={orgValue}>
			<option value="">Any</option>
			<option value="public">Public</option>
			{#each data.orgs as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
		</select>
	</label>
	<div class="go">
		<button type="submit">Filter</button>
		{#if data.filtered}<a href={here}>Clear</a>{/if}
	</div>
</form>

{#if data.searches.length === 0}
	{#if w.outOfRange}
		<p class="empty">
			There's no page {count(q.page)}. <a href="{here}{data.pages.first}">Go to page 1</a>
		</p>
	{:else}
		<p class="empty">{data.filtered ? 'No searches match these filters.' : 'No searches yet.'}</p>
	{/if}
{:else}
	<div class="table-wrap">
		<table class="stacked searches">
			<thead>
				<tr>
					<th scope="col">Time</th>
					<th scope="col">User</th>
					<th scope="col">Context</th>
					<th scope="col">Query</th>
					<th scope="col">Data sources</th>
					<th scope="col">Outcome</th>
					<th scope="col" class="num">Time taken</th>
					<th scope="col">Rating</th>
				</tr>
			</thead>
			<tbody>
				{#each data.searches as s (s.id)}
					{@const ms = s.total_ms ?? s.retrieval_ms}
					<tr>
						<td data-label="Time" class="mono"
							><time datetime={s.created_at}>{stamp(s.created_at)}</time></td
						>
						<td data-label="User" class="user">{s.user_email ?? 'Deleted user'}</td>
						<td data-label="Context">{s.org_id ? (s.org_name ?? 'Deleted org') : 'Public'}</td>
						<td data-label="Query" class="query">
							<a href={resolve('/(app)/admin/searches/[id]', { id: s.id })}
								>{s.query ?? `Not kept (${count(s.query_length)} characters)`}</a
							>
							{#if s.step_n && s.step_n > 1}<span class="muted mono">step {s.step_n}</span>{/if}
						</td>
						<td data-label="Data sources" class="mono">{s.data_source_ids.join(', ')}</td>
						<td data-label="Outcome" class="mono">
							{humanise(s.status)}{#if s.status === 'ok' && s.result_count !== null}<span
									class="muted">{` · ${count(s.result_count)}`}</span
								>{/if}
						</td>
						<td data-label="Time taken" class="num mono">{ms === null ? '' : `${seconds(ms)} s`}</td
						>
						<td data-label="Rating" class="ratings">
							<RatingMark who="User" rating={s.user_rating} note={s.user_note} />
							<RatingMark who="Trail" rating={s.trail_rating} />
							<RatingMark who="Review" rating={s.review_rating} />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if w.hasPrevious || w.hasNext}
	<nav class="pages" aria-label="Pages">
		{#if w.hasPrevious}<a href="{here}{data.pages.previous}" rel="prev">Previous</a>{/if}
		<span class="readout"
			><span>page <b>{count(q.page)}</b> of <b>{count(w.pageCount)}</b></span></span
		>
		{#if w.hasNext}<a href="{here}{data.pages.next}" rel="next">Next</a>{/if}
	</nav>
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem 1rem;
		margin-bottom: 1.5rem;
	}
	.filters label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.875rem;
		font-weight: 500;
	}
	.filters input {
		width: 16rem;
		max-width: 100%;
	}
	.go {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.searches td {
		vertical-align: top;
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}
	.user {
		overflow-wrap: anywhere;
	}
	.query {
		min-width: 14rem;
	}
	.query .muted {
		margin-left: 0.375rem;
	}
	.num {
		text-align: right;
		white-space: nowrap;
	}
	@media (min-width: 48rem) {
		.ratings {
			white-space: nowrap;
		}
	}
	.pages {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
		margin-top: 1.5rem;
	}
</style>
