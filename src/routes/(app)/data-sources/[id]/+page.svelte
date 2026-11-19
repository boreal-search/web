<script lang="ts">
	import { resolve } from '$app/paths';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import { count, humanise, plural } from '#lib/format.js';
	import { Resolved } from '#lib/resolved.svelte.js';
	import Jobs from './Jobs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The head shows what web knows (id, granting group) until the engine's detail streams in.
	const loaded = new Resolved(() => data.detail);
	// Another data source's detail lingers until this one's arrives: match the id.
	let ds = $derived(
		loaded.current?.ok && loaded.current.data.dataSource.id === data.id
			? loaded.current.data.dataSource
			: null
	);
	let here = $derived(resolve('/(app)/data-sources/[id]', { id: data.id }));
	let nextOffset = $derived(data.offset + data.pageSize);
	let prevOffset = $derived(Math.max(data.offset - data.pageSize, 0));
</script>

<p class="back"><a href={resolve('/(app)/data-sources')}>← Data sources</a></p>

<svelte:head>
	<title>{ds?.name ?? data.id} · Boreal Search</title>
</svelte:head>

<header class="page-head">
	<h1>{ds?.name ?? data.id}</h1>
	{#if ds?.description}<p class="muted">{ds.description}</p>{/if}
	<p class="readout">
		{#if ds}
			<span><b>{humanise(ds.status)}</b></span>
			<span
				><b>{count(ds.document_count)}</b>
				{plural(ds.document_count, 'document', 'documents')}</span
			>
			<span><b>{count(ds.page_count)}</b> {plural(ds.page_count, 'page', 'pages')}</span>
		{:else}
			{#if data.group}<span>in <b>{data.group}</b></span>{/if}
			{#if loaded.current && !loaded.current.ok}<span>details <b>unavailable</b></span>{/if}
		{/if}
	</p>
</header>

{#await data.detail}
	<section class="band" aria-labelledby="documents">
		<div class="band-head"><h2 id="documents">Documents</h2></div>
		<Skeleton label="Loading documents" rows={6} columns={4} />
	</section>
{:then result}
	{#if !result.ok}
		<FailureNotice
			failure={result.failure}
			effect={data.showJobs
				? "Documents and ingestion jobs for this data source can't be loaded."
				: "Documents for this data source can't be loaded."}
		/>
	{:else}
		{@const detail = result.data}
		{@const documents = detail.documents.items}
		{@const shownCount = documents.length}
		{@const hasPrev = data.offset > 0 && shownCount > 0}
		{@const hasNext = nextOffset < detail.documents.total}
		<section class="band" aria-labelledby="documents">
			<div class="band-head">
				<h2 id="documents">Documents</h2>
				{#if shownCount > 0}
					<p class="readout">
						<span
							>Showing <b>{count(data.offset + 1)}–{count(data.offset + shownCount)}</b>
							of <b>{count(detail.documents.total)}</b></span
						>
					</p>
				{/if}
			</div>

			{#if detail.documents.total === 0}
				<p class="empty">No documents yet.</p>
			{:else if shownCount === 0}
				<p class="empty">
					No documents past number {count(detail.documents.total)}.
					<a href={here}>Back to the first page</a>
				</p>
			{:else}
				<table class="stacked documents">
					<thead>
						<tr>
							<th scope="col">Title</th>
							<th scope="col">File</th>
							<th scope="col" class="num">Pages</th>
							<th scope="col">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each documents as doc (doc.id)}
							<tr>
								<td class="title">
									<a
										href={resolve('/pdf/[ds]/[doc]', { ds: data.id, doc: doc.id })}
										target="_blank"
										rel="external noopener">{doc.title}</a
									>
								</td>
								<td class="file" data-label="File">{doc.filename}</td>
								<td class="num" data-label="Pages"
									>{doc.page_count === null ? '—' : count(doc.page_count)}</td
								>
								<td class="state" data-label="Status">{humanise(doc.status)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if hasPrev || hasNext}
					<nav class="actions" aria-label="Document pages">
						{#if hasPrev}
							<a class="button" href="{here}?offset={prevOffset}">← Previous</a>
						{/if}
						{#if hasNext}
							<a class="button" href="{here}?offset={nextOffset}">Next →</a>
						{/if}
					</nav>
				{/if}
			{/if}
		</section>
		{#if detail.jobs}<Jobs jobs={detail.jobs} />{/if}
	{/if}
{/await}

<style>
	.back {
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.band-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem 1.5rem;
		margin-bottom: 1rem;
	}
	.band-head h2 {
		margin: 0;
	}

	.documents th:first-child {
		width: 55%;
	}
	.title a {
		font-weight: 500;
	}
	.file {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--color-muted);
		overflow-wrap: anywhere;
	}
	.state {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	/* Phones: each row is a short block, not a column of labels. */
	@media (max-width: 40rem) {
		.stacked td[data-label] {
			align-items: baseline;
			gap: 0.5rem;
		}
		.stacked td[data-label]::before {
			flex: none;
		}
		.documents tr {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem 1.5rem;
		}
		.documents .title,
		.documents .file {
			display: block;
			flex-basis: 100%;
		}
		.documents .file::before {
			content: none;
		}
	}
</style>
