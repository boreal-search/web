<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Data sources</h1>

{#if !data.inOrg}
	<p>You're not in an org yet. Ask your org admin for an invite.</p>
{:else if data.accessibleDataSourceIds.length === 0}
	<p>
		Your org doesn't have access to any data sources yet. Ask a platform admin to grant it some.
	</p>
{:else if data.engineError}
	<p class="error" role="alert">{data.engineError}</p>
{:else if data.dataSources.length === 0}
	<p class="muted">
		The data sources your org has access to aren't available on the engine right now.
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
