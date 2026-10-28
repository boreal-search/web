<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let noOrg = $derived(data.access.memberships.length === 0);
	let shown = $derived(data.groups.filter((g) => g.dataSources.length > 0));
</script>

<h1>Data sources</h1>

{#if data.access.dataSourceIds.length === 0}
	{#if noOrg}
		<p>
			You're not in an org yet, and there are no public data sources. Ask your org admin for an
			invite, or contact us to search your own documents.
		</p>
	{:else}
		<p>
			Your org doesn't have access to any data sources yet. Ask a platform admin to grant it some.
		</p>
	{/if}
{:else if data.engineError}
	<p class="error" role="alert">{data.engineError}</p>
{:else if shown.length === 0}
	<p class="muted">The data sources you have access to aren't available on the engine right now.</p>
{:else}
	{#each shown as group, i (group.label)}
		<section aria-labelledby="group-{i}">
			<h2 id="group-{i}">{group.label}</h2>
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
					{#each group.dataSources as ds (ds.id)}
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
		</section>
	{/each}
	<p><a href={resolve('/(app)/search')}>Search these data sources →</a></p>
{/if}

{#if noOrg && data.access.dataSourceIds.length > 0}
	<p class="muted">Want your own documents? Contact us.</p>
{/if}
