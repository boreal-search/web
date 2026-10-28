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
	let names = $derived(new Map(data.publicCorpora.dataSources.map((ds) => [ds.id, ds.name])));

	// createOrg errors are one string: an empty name is the name's fault, anything else the slug's.
	let nameError = $derived(form?.error && !form.name ? form.error : null);
	let slugError = $derived(form?.error && form.name ? form.error : null);
</script>

<svelte:head>
	<title>Platform admin · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>Platform admin</h1>
	<p class="readout">
		<span><b>{data.orgs.length}</b> {data.orgs.length === 1 ? 'org' : 'orgs'}</span>
		<span><b>{data.publicCorpora.publicIds.length}</b> public data sources</span>
	</p>
</div>
<p class="muted">
	Platform admins see and change every org. They are added in SQL (the
	<code>platform_admins</code> table), not here.
</p>

<section class="band" aria-labelledby="orgs-heading">
	<h2 id="orgs-heading">Orgs</h2>
	<p id="orgs-help" class="muted">
		Open an org to manage its members, data source access, email domains and settings.
	</p>
	{#if data.orgs.length === 0}
		<p class="empty">No orgs yet.</p>
	{:else}
		<table class="stacked" aria-describedby="orgs-help">
			<thead>
				<tr>
					<th scope="col">Name</th>
					<th scope="col">Slug</th>
					<th scope="col" class="num">Members</th>
					<th scope="col">Data sources</th>
				</tr>
			</thead>
			<tbody>
				{#each data.orgs as org (org.id)}
					<tr>
						<td data-label="Name">
							<a href={resolve('/(app)/orgs/[slug]/manage', { slug: org.slug })}>{org.name}</a>
						</td>
						<td data-label="Slug"><code>{org.slug}</code></td>
						<td data-label="Members" class="num">{org.memberCount}</td>
						<td data-label="Data sources" class="sources">
							{#if org.dataSourceIds.length === 0}
								<span class="muted">None</span>
							{:else}
								{org.dataSourceIds.map((id) => names.get(id) ?? id).join(', ')}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section class="band" aria-labelledby="create-heading">
	<h2 id="create-heading">Create an org</h2>
	<p class="muted">
		A new org has no members and no data sources. Next, add its first org admin and grant it data
		sources.
	</p>
	<form method="POST" action="?/createOrg" class="stack" use:enhance>
		<label class="field">
			Name
			<input
				name="name"
				required
				value={form?.name ?? ''}
				aria-invalid={nameError ? 'true' : undefined}
				aria-describedby="name-help{nameError ? ' name-error' : ''}"
			/>
			<span class="help" id="name-help">Shown on the org's pages and in invite emails.</span>
			{#if nameError}<span class="field-error" id="name-error">{nameError}</span>{/if}
		</label>
		<label class="field">
			Slug
			<input
				name="slug"
				required
				autocomplete="off"
				spellcheck="false"
				value={form?.slug ?? ''}
				aria-invalid={slugError ? 'true' : undefined}
				aria-describedby="slug-help{slugError ? ' slug-error' : ''}"
			/>
			<span class="help" id="slug-help">
				2–63 lower-case letters, digits and dashes. Used in URLs (<code>/orgs/slug/manage</code>)
				and can't be changed in the app later.
			</span>
			{#if slugError}<span class="field-error" id="slug-error">{slugError}</span>{/if}
		</label>
		<div class="actions">
			<button type="submit" class="primary">Create org</button>
		</div>
	</form>
</section>

<section class="band" aria-labelledby="public-heading">
	<h2 id="public-heading">Public data sources</h2>
	{#if data.publicCorpora.engineError}
		<p class="notice" data-tone="error" role="alert">
			The data source list can't be loaded, so public access can't be changed right now.
			{data.publicCorpora.engineError}
		</p>
		<p class="readout">
			<span>public <b>{data.publicCorpora.publicIds.join(', ') || 'none'}</b></span>
		</p>
	{:else if data.publicCorpora.dataSources.length === 0}
		<p class="empty">The engine has no data sources.</p>
	{:else}
		<form method="POST" action="?/savePublic" class="stack" use:enhance={keep}>
			<fieldset aria-describedby="public-help">
				<legend>Data sources anyone can search</legend>
				{#each data.publicCorpora.dataSources as ds (ds.id)}
					<label class="check">
						<input
							type="checkbox"
							name="data_source_id"
							value={ds.id}
							checked={isPublic.has(ds.id)}
						/>
						{ds.name}
					</label>
				{/each}
				<span id="public-help" class="help">
					Every signed-in user can search these, with or without an org.
				</span>
			</fieldset>
			{#if form?.publicError}
				<p class="notice" data-tone="error" role="alert">{form.publicError}</p>
			{:else if form?.publicNotice}
				<p class="notice" role="status">{form.publicNotice}</p>
			{/if}
			<div class="actions">
				<button type="submit" class="primary">Save public data sources</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.sources {
		overflow-wrap: anywhere;
	}
	fieldset .help {
		display: block;
		margin-top: 0.5rem;
	}
</style>
