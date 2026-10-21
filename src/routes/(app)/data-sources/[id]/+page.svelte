<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let ds = $derived(data.dataSource);
	let nextOffset = $derived(data.offset + data.pageSize);
	let prevOffset = $derived(Math.max(data.offset - data.pageSize, 0));
	let activeJobs = $derived(
		data.jobs.filter((j) => j.status === 'queued' || j.status === 'running')
	);
</script>

<p><a href={resolve('/(app)')}>← Data sources</a></p>
<h1>{ds.name}</h1>
{#if ds.description}<p class="muted">{ds.description}</p>{/if}
<p>
	Status: <strong>{ds.status}</strong> · {ds.document_count} documents · {ds.page_count} pages
</p>

<section>
	<h2>Ingestion jobs</h2>
	{#if data.jobs.length === 0}
		<p class="muted">No jobs recorded.</p>
	{:else}
		{#if activeJobs.length > 0}
			<p>{activeJobs.length} active</p>
		{/if}
		<table>
			<thead>
				<tr>
					<th>Type</th>
					<th>Status</th>
					<th>Progress</th>
					<th>Created</th>
					<th>Error</th>
				</tr>
			</thead>
			<tbody>
				{#each data.jobs as job (job.id)}
					<tr>
						<td>{job.type}</td>
						<td>{job.status}</td>
						<td>
							{#if job.progress}
								{job.progress.done} / {job.progress.total}
							{:else}
								—
							{/if}
						</td>
						<td>{new Date(job.created_at).toLocaleString()}</td>
						<td class="error">{job.error ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section>
	<h2>Documents <span class="muted">({data.documents.total})</span></h2>
	{#if data.documents.items.length === 0}
		<p class="muted">No documents.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Title</th>
					<th>File</th>
					<th>Pages</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each data.documents.items as doc (doc.id)}
					<tr>
						<td><a href={doc.pdf_url} target="_blank" rel="external noopener">{doc.title}</a></td>
						<td class="muted">{doc.filename}</td>
						<td>{doc.page_count ?? '—'}</td>
						<td>{doc.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p>
			{#if data.offset > 0}
				<a href="{resolve('/(app)/data-sources/[id]', { id: ds.id })}?offset={prevOffset}"
					>← Previous</a
				>
			{/if}
			{#if nextOffset < data.documents.total}
				<a href="{resolve('/(app)/data-sources/[id]', { id: ds.id })}?offset={nextOffset}">Next →</a
				>
			{/if}
		</p>
	{/if}
</section>
