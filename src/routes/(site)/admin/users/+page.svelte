<script lang="ts">
	import { resolve } from '$app/paths';
	import { count, day, plural, stamp } from '#lib/format.js';
	import { ROLE_LABELS } from '#lib/roles.js';
	import AdminNav from '../AdminNav.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const here = resolve('/(site)/admin/users');
	let w = $derived(data.window);
	let orgName = $derived(data.orgs.find((o) => o.id === data.query.org)?.name ?? null);
	let filtered = $derived(Boolean(data.query.q || data.query.org));
</script>

<svelte:head>
	<title>Users · Platform admin · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<AdminNav />
	<h1>Users</h1>
	<p class="readout">
		{#if w.first > 0}
			<span
				>Showing <b>{w.first === w.last ? count(w.first) : `${count(w.first)}–${count(w.last)}`}</b>
				of <b>{count(data.total)}</b>
				{plural(data.total, 'user')}</span
			>
		{:else}
			<span><b>{count(data.total)}</b> {plural(data.total, 'user')}</span>
		{/if}
		{#if data.query.q}<span>matching <b>{data.query.q}</b></span>{/if}
		{#if orgName}<span>in <b>{orgName}</b></span>{/if}
	</p>
</div>

<form method="GET" action={here} role="search" class="find">
	<label for="q">Find users</label>
	<div class="row">
		<input
			id="q"
			type="search"
			name="q"
			value={data.query.q}
			autocomplete="off"
			spellcheck="false"
			aria-describedby="q-help"
		/>
		<select name="org" value={data.query.org ?? ''} aria-label="Org">
			<option value="">Any org</option>
			{#each data.orgs as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
		</select>
		<button type="submit">Find</button>
	</div>
	<span class="help" id="q-help">
		Part of an email or display name.
		{#if filtered}<a href={here}>Show all users</a>{/if}
	</span>
</form>

{#if data.users.length === 0}
	{#if w.outOfRange}
		<p class="empty">
			There's no page {count(data.query.page)}.
			<a href="{here}{data.pages.first}">Go to page 1</a>
		</p>
	{:else if filtered}
		<p class="empty">No users match these filters.</p>
	{:else}
		<p class="empty">No users yet.</p>
	{/if}
{:else}
	<table class="stacked users">
		<thead>
			<tr>
				<th scope="col">Email</th>
				<th scope="col">Display name</th>
				<th scope="col">Orgs</th>
				<th scope="col">Joined</th>
				<th scope="col">Last sign-in</th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<td data-label="Email">
						<span class="email"
							>{u.email}
							{#if u.isPlatformAdmin}<span class="badge">Platform admin</span>{/if}</span
						>
					</td>
					<td data-label="Display name">
						{#if u.displayName}{u.displayName}{:else}<span class="muted">None</span>{/if}
					</td>
					<td data-label="Orgs">
						{#if u.orgs.length === 0}
							<span class="muted">None</span>
						{:else}
							<ul class="orgs">
								{#each u.orgs as o (o.slug)}
									<li>
										<a href={resolve('/(app)/orgs/[slug]/manage', { slug: o.slug })}>{o.name}</a>
										<span class="muted">{ROLE_LABELS[o.role]}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</td>
					<td data-label="Joined" class="when">
						<time datetime={u.joinedAt}>{day(u.joinedAt)}</time>
					</td>
					<td data-label="Last sign-in" class="when">
						{#if u.lastSignInAt}
							<time datetime={u.lastSignInAt}>{stamp(u.lastSignInAt)}</time>
						{:else}
							<span class="muted">Never</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if w.hasPrevious || w.hasNext}
	<nav class="pages" aria-label="Pages">
		{#if w.hasPrevious}<a href="{here}{data.pages.previous}" rel="prev">Previous</a>{/if}
		<span class="readout"
			><span>page <b>{count(data.query.page)}</b> of <b>{count(w.pageCount)}</b></span></span
		>
		{#if w.hasNext}<a href="{here}{data.pages.next}" rel="next">Next</a>{/if}
	</nav>
{/if}

<style>
	.find {
		display: grid;
		gap: 0.375rem;
		max-width: 40rem;
		margin-bottom: 1.5rem;
	}
	.find label {
		font-weight: 500;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.help a {
		margin-left: 0.5rem;
	}
	.users td {
		vertical-align: top;
	}
	.email {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.badge {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0 0.375rem;
		border: 1px solid var(--color-edge);
		border-radius: 3px;
		font: 500 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
		white-space: nowrap;
	}
	.orgs {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.orgs .muted {
		margin-left: 0.25rem;
		font-size: 0.875rem;
	}
	.when {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		white-space: nowrap;
	}
	.pages {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
		margin-top: 1.5rem;
	}
</style>
