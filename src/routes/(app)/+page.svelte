<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Data sources</h1>

{#if data.engineError}
	<p class="error" role="alert">Could not reach the engine: {data.engineError}</p>
{/if}

{#if data.dataSources.length === 0}
	<p class="muted">
		No data sources are available to your organisation yet.
		{#if data.accessibleDataSourceIds.length === 0}
			Ask an admin to grant your org access.
		{/if}
	</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Status</th>
				<th>Documents</th>
				<th>Pages</th>
			</tr>
		</thead>
		<tbody>
			{#each data.dataSources as ds (ds.id)}
				<tr>
					<td>
						<a href={resolve('/(app)/data-sources/[id]', { id: ds.id })}>{ds.name}</a>
						{#if ds.description}<div class="muted">{ds.description}</div>{/if}
					</td>
					<td>{ds.status}</td>
					<td>{ds.document_count}</td>
					<td>{ds.page_count}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p><a href={resolve('/(app)/search')}>Search these data sources →</a></p>
{/if}
