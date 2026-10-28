<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>Platform admin</h1>
<p class="muted">
	Platform admins can see and change every org. They are added in SQL (the
	<code>platform_admins</code> table), not here.
</p>

<section aria-labelledby="orgs-heading">
	<h2 id="orgs-heading">Orgs</h2>
	<p class="muted">
		Open an org to manage its members, data source access, email domains and settings.
	</p>
	{#if data.orgs.length === 0}
		<p class="muted">No orgs yet.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Slug</th>
					<th>Members</th>
					<th>Data sources</th>
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

<section aria-labelledby="create-heading">
	<h2 id="create-heading">Create org</h2>
	<p class="muted">
		A new org has no members and no data sources. Next you'll add its first org admin and grant it
		data sources.
	</p>
	<form method="POST" action="?/createOrg" class="stack" use:enhance>
		<label>
			Name
			<input name="name" required value={form?.name ?? ''} aria-describedby="name-help" />
		</label>
		<small id="name-help" class="muted">Shown on the org admin page and in invite emails.</small>
		<label>
			Slug
			<input name="slug" required value={form?.slug ?? ''} aria-describedby="slug-help" />
		</label>
		<small id="slug-help" class="muted">
			Lower-case letters, digits and dashes, 2–63 characters. Used in URLs (/orgs/<em>slug</em
			>/manage) and can't be changed in the app later.
		</small>
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button type="submit" class="primary">Create org</button>
	</form>
</section>
