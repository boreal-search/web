<script lang="ts">
	import { resolve } from '$app/paths';
	import { count, humanise, plural } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let noOrg = $derived(data.access.memberships.length === 0);
	let orgName = $derived(data.access.context.kind === 'org' ? data.access.context.org.name : null);
	let granted = $derived(data.access.dataSourceIds.length);
	let shown = $derived(data.groups.filter((g) => g.dataSources.length > 0));
	let all = $derived(shown.flatMap((g) => g.dataSources));
	let totals = $derived({
		sources: all.length,
		documents: all.reduce((n, ds) => n + ds.document_count, 0),
		pages: all.reduce((n, ds) => n + ds.page_count, 0)
	});
</script>

<header class="head">
	<div class="page-head">
		<h1>Data sources</h1>
		{#if all.length > 0}
			<p class="readout">
				<span
					><b>{count(totals.sources)}</b>
					{plural(totals.sources, 'data source', 'data sources')}</span
				>
				<span
					><b>{count(totals.documents)}</b>
					{plural(totals.documents, 'document', 'documents')}</span
				>
				<span><b>{count(totals.pages)}</b> {plural(totals.pages, 'page', 'pages')}</span>
			</p>
		{:else if granted > 0}
			<p class="readout">
				<span><b>{count(granted)}</b> {plural(granted, 'data source', 'data sources')}</span>
			</p>
		{/if}
	</div>
	{#if granted > 0}
		<a class="button primary" href={resolve('/(app)/search')}>Search these data sources</a>
	{/if}
</header>

{#if granted === 0}
	{#if noOrg}
		<p class="empty">
			You're not in an org yet, and there are no public data sources. Ask your org admin for an
			invite, or contact us to search your own documents.
		</p>
	{:else}
		<p class="empty">
			No data sources are available to {orgName ?? 'your org'} yet. Ask a platform admin to grant access.
		</p>
	{/if}
{:else if data.engineError}
	<p class="notice" role="status">
		Data source details can't be loaded right now. {data.engineError}
	</p>
{:else if shown.length === 0}
	<p class="empty">These data sources aren't available on the search engine right now.</p>
{:else}
	{#each shown as group, i (group.label)}
		<section class="band" aria-labelledby="group-{i}">
			<h2 id="group-{i}">{group.label}</h2>
			<table class="stacked sources">
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">Status</th>
						<th scope="col" class="num">Documents</th>
						<th scope="col" class="num">Pages</th>
					</tr>
				</thead>
				<tbody>
					{#each group.dataSources as ds (ds.id)}
						<tr>
							<td class="name">
								<a href={resolve('/(app)/data-sources/[id]', { id: ds.id })}>{ds.name}</a>
								{#if ds.description}<span class="muted">{ds.description}</span>{/if}
							</td>
							<td class="state" data-label="Status">{humanise(ds.status)}</td>
							<td class="num" data-label="Documents">{count(ds.document_count)}</td>
							<td class="num" data-label="Pages">{count(ds.page_count)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/each}
{/if}

{#if noOrg && granted > 0}
	<p class="muted">Want to search your own documents? Contact us.</p>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 1rem 2rem;
		margin-bottom: 2rem;
	}
	.head .page-head {
		margin-bottom: 0;
	}

	.sources th:first-child {
		width: 100%;
	}
	.name a {
		font-weight: 500;
	}
	.name span {
		display: block;
		font-size: 0.875rem;
	}
	.state {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	/* Phones: name and description across the row, then the three readings on one line. */
	@media (max-width: 40rem) {
		.sources tr {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem 1.5rem;
		}
		.sources .name {
			display: block;
			flex-basis: 100%;
			margin-bottom: 0.25rem;
		}
		.sources td[data-label] {
			gap: 0.5rem;
			align-items: baseline;
			color: var(--color-ink);
		}
		.sources td[data-label]::before {
			flex: none;
		}
	}
</style>
