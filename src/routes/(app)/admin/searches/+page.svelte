<script lang="ts">
	import { resolve } from '$app/paths';
	import { count, humanise, plural, stamp } from '#lib/format.js';
	import type { SortKey } from '#lib/server/search-review.js';
	import { seconds } from '#lib/search-view.js';
	import AdminNav from '../AdminNav.svelte';
	import RatingMark from './RatingMark.svelte';
	import ReviewFilters from './ReviewFilters.svelte';
	import SortHeader from './SortHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const here = resolve('/(app)/admin/searches');
	let w = $derived(data.window);
	let q = $derived(data.query);
	const exportHref = resolve('/(app)/admin/searches/export');

	const COLUMNS: [SortKey, string][] = [
		['time', 'Time'],
		['user', 'User'],
		['context', 'Context'],
		['query', 'Query'],
		['sources', 'Data sources'],
		['outcome', 'Outcome'],
		['taken', 'Time taken'],
		['rating', 'Rating']
	];
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
		<span
			>sorted by <b>{COLUMNS.find(([k]) => k === q.sort.key)?.[1].toLowerCase()}</b>, {q.sort
				.dir === 'asc'
				? 'ascending'
				: 'descending'}</span
		>
	</p>
</div>

<ReviewFilters
	{q}
	outcomes={data.outcomes}
	orgs={data.orgs}
	filtered={data.filtered}
	sorted={data.sorted}
/>

{#if data.total > 0}
	<p class="export">
		<a class="button" href="{exportHref}{data.pages.first}" download>Download CSV</a>
		<span class="muted"
			>{data.total > data.exportMax
				? `The first ${count(data.exportMax)} of ${count(data.total)} matching searches, in this order.`
				: `All ${count(data.total)} matching ${plural(data.total, 'search', 'searches')}, in this order.`}</span
		>
	</p>
{/if}

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
					{#each COLUMNS as [key, label] (key)}
						<SortHeader
							{key}
							{label}
							sort={q.sort}
							search={data.sorts[key]}
							num={key === 'taken'}
						/>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.searches as s (s.id)}
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
						<td data-label="Time taken" class="num mono"
							>{s.total_ms === null ? '' : `${seconds(s.total_ms)} s`}</td
						>
						<td data-label="Rating" class="ratings">
							<RatingMark who="Response" rating={s.rating} note={s.note} />
							<RatingMark who="Trail" rating={s.trail_rating} note={s.trail_note} />
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
	.export {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 1rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
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
