<!-- A data source's latest ingestion jobs: platform admins only (the load fetches them for no one else). -->
<script lang="ts">
	import PlatformOnly from '#lib/components/PlatformOnly.svelte';
	import { count, humanise, stamp } from '#lib/format.js';
	import type { Job } from '#lib/server/engine.types.js';

	let { jobs }: { jobs: Job[] } = $props();

	let active = $derived(jobs.filter((j) => j.status === 'queued' || j.status === 'running').length);
	let failed = $derived(jobs.filter((j) => j.status === 'failed').length);
</script>

<section class="band" aria-labelledby="jobs">
	<div class="band-head">
		<h2 id="jobs">Ingestion jobs</h2>
		{#if jobs.length > 0}
			<p class="readout">
				<span>Latest <b>{jobs.length}</b></span>
				{#if active > 0}<span><b>{active}</b> active</span>{/if}
				{#if failed > 0}<span><b>{failed}</b> failed</span>{/if}
			</p>
		{/if}
	</div>
	<PlatformOnly note="Other users don't see this section." />

	{#if jobs.length === 0}
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
				{#each jobs as job (job.id)}
					<tr class={{ 'has-error': job.error }}>
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
							<td colspan="4" class={{ failed: job.status === 'failed' }}>
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
