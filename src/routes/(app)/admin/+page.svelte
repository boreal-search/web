<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>Admin</h1>

<section>
	<h2>Orgs</h2>
	{#if data.orgs.length === 0}
		<p class="muted">No orgs yet.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Slug</th>
					<th>Members</th>
					<th>Corpora</th>
				</tr>
			</thead>
			<tbody>
				{#each data.orgs as org (org.id)}
					<tr>
						<td
							><a href={resolve('/(app)/orgs/[slug]/manage', { slug: org.slug })}>{org.name}</a></td
						>
						<td>{org.slug}</td>
						<td>{org.memberCount}</td>
						<td>{org.dataSourceIds.join(', ') || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section>
	<h2>Create org</h2>
	<form method="POST" action="?/createOrg" class="stack" use:enhance>
		<label>
			Name
			<input name="name" required value={form?.name ?? ''} />
		</label>
		<label>
			Slug
			<small class="muted">lower-case letters, digits and dashes; used in URLs</small>
			<input name="slug" required value={form?.slug ?? ''} />
		</label>
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button type="submit" class="primary">Create org</button>
	</form>
</section>
