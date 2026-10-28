<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	// Keep the checkboxes; the reloaded data drives them.
	const keep: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });
	let isPublic = $derived(new Set(data.publicCorpora.publicIds));
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

<section aria-labelledby="public-heading">
	<h2 id="public-heading">Public corpora</h2>
	{#if data.publicCorpora.engineError}
		<p class="error" role="alert">{data.publicCorpora.engineError}</p>
		<p class="muted">Public: {data.publicCorpora.publicIds.join(', ') || 'none'}</p>
	{:else if data.publicCorpora.dataSources.length === 0}
		<p class="muted">The engine has no data sources.</p>
	{:else}
		<form method="POST" action="?/savePublic" class="stack" use:enhance={keep}>
			<fieldset aria-describedby="public-help">
				<legend>Data sources anyone can search</legend>
				<small id="public-help" class="muted">
					Every signed-in user can search these, without an org or a seat.
				</small>
				{#each data.publicCorpora.dataSources as ds (ds.id)}
					<label>
						<input
							type="checkbox"
							name="data_source_id"
							value={ds.id}
							checked={isPublic.has(ds.id)}
						/>
						{ds.name}
					</label>
				{/each}
			</fieldset>
			{#if form?.publicError}
				<p class="error" role="alert">{form.publicError}</p>
			{:else if form?.publicNotice}
				<p role="status">{form.publicNotice}</p>
			{/if}
			<button type="submit" class="primary">Save public corpora</button>
		</form>
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
