<script lang="ts">
	import { resolve } from '$app/paths';
	import { count, humanise, plural, stamp } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let ds = $derived(data.dataSource);
	let total = $derived(data.documents.total);
	let shownCount = $derived(data.documents.items.length);
	let here = $derived(resolve('/(app)/data-sources/[id]', { id: ds.id }));
	let nextOffset = $derived(data.offset + data.pageSize);
	let prevOffset = $derived(Math.max(data.offset - data.pageSize, 0));
	let hasPrev = $derived(data.offset > 0 && shownCount > 0);
	let hasNext = $derived(nextOffset < total);
	let active = $derived(
		data.jobs.filter((j) => j.status === 'queued' || j.status === 'running').length
	);
	let failed = $derived(data.jobs.filter((j) => j.status === 'failed').length);
</script>

<p class="back"><a href={resolve('/(app)')}>← Data sources</a></p>

<header class="page-head">
	<h1>{ds.name}</h1>
	{#if ds.description}<p class="muted">{ds.description}</p>{/if}
	<p class="readout">
		<span><b>{humanise(ds.status)}</b></span>
		<span
			><b>{count(ds.document_count)}</b>
			{plural(ds.document_count, 'document', 'documents')}</span
		>
		<span><b>{count(ds.page_count)}</b> {plural(ds.page_count, 'page', 'pages')}</span>
	</p>
</header>

<section class="band" aria-labelledby="documents">
	<div class="band-head">
		<h2 id="documents">Documents</h2>
		{#if shownCount > 0}
			<p class="readout">
				<span
					>Showing <b>{count(data.offset + 1)}–{count(data.offset + shownCount)}</b>
					of <b>{count(total)}</b></span
				>
			</p>
		{/if}
	</div>

	{#if total === 0}
		<p class="empty">No documents yet.</p>
	{:else if shownCount === 0}
		<p class="empty">
			No documents past number {count(total)}.
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
				{#each data.documents.items as doc (doc.id)}
					<tr>
						<td class="title">
							<a href={doc.pdf_url} target="_blank" rel="external noopener">{doc.title}</a>
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

<section class="band" aria-labelledby="jobs">
	<div class="band-head">
		<h2 id="jobs">Ingestion jobs</h2>
		{#if data.jobs.length > 0}
			<p class="readout">
				<span>Latest <b>{data.jobs.length}</b></span>
				{#if active > 0}<span><b>{active}</b> active</span>{/if}
				{#if failed > 0}<span><b>{failed}</b> failed</span>{/if}
			</p>
		{/if}
	</div>

	{#if data.jobs.length === 0}
		<p class="empty">No ingestion jobs recorded.</p>
	{:else}
		<table class="stacked jobs">
			<thead>
				<tr>
					<th scope="col">Type</th>
					<th scope="col">Status</th>
					<th scope="col" class="num">Progress</th>
					<th scope="col">Created</th>
				</tr>
			</thead>
			<tbody>
				{#each data.jobs as job (job.id)}
					<tr class:has-error={job.error}>
						<td class="state" data-label="Type">{humanise(job.type)}</td>
						<td class="state" data-label="Status">{humanise(job.status)}</td>
						<td class="num" data-label="Progress">
							{#if job.progress}
								{count(job.progress.done)} / {count(job.progress.total)}
							{:else}
								—
							{/if}
						</td>
						<td class="state" data-label="Created">
							<time datetime={job.created_at}>{stamp(job.created_at)}</time>
						</td>
					</tr>
					{#if job.error}
						<tr class="job-error">
							<td colspan="4" class:failed={job.status === 'failed'}>
								<span class="label">Error</span>
								{job.error}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
		{#if active > 0}
			<p class="muted note">This list doesn't refresh on its own. Reload to see progress.</p>
		{/if}
	{/if}
</section>

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

	.jobs th:nth-child(-n + 3) {
		width: 9rem;
	}
	.jobs .has-error td {
		border-bottom: 0;
		padding-bottom: 0.125rem;
	}
	.job-error td {
		padding-top: 0;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--color-muted);
		overflow-wrap: anywhere;
	}
	.job-error td.failed {
		color: var(--color-danger);
	}
	.job-error .label {
		margin-right: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.note {
		margin: 0;
		font-size: 0.875rem;
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

		.jobs tr {
			grid-template-columns: minmax(0, 1fr) max-content;
			column-gap: 1rem;
		}
		.jobs td[data-label='Type'],
		.jobs td[data-label='Created'] {
			grid-column: 1;
		}
		.jobs td[data-label='Type']::before,
		.jobs td[data-label='Created']::before {
			content: none;
		}
		.jobs td[data-label='Type'] {
			font-weight: 500;
		}
		.jobs td[data-label='Status'] {
			grid-area: 1 / 2;
		}
		.jobs td[data-label='Progress'] {
			grid-area: 2 / 2;
		}
		.jobs td[data-label='Created'] {
			grid-row: 2;
			color: var(--color-muted);
		}
		.jobs .has-error {
			border-bottom: 0;
			padding-bottom: 0;
		}
		.job-error {
			padding-top: 0.25rem;
		}
		.job-error td {
			display: block;
		}
	}
</style>
