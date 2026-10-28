<script lang="ts">
	import { resolve } from '$app/paths';
	import { count, day, plural, stamp } from '#lib/format.js';
	import { ROLE_LABELS } from '#lib/roles.js';
	import AdminNav from '../AdminNav.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const here = resolve('/(app)/admin/users');
	/** `?q=…&page=…` for another page of the same search; page 1 and an empty search are left out. */
	function pageSearch(n: number) {
		const entries: [string, string][] = [];
		if (data.query.q) entries.push(['q', data.query.q]);
		if (n > 1) entries.push(['page', String(n)]);
		return entries.length ? `?${new URLSearchParams(entries)}` : '';
	}
	let w = $derived(data.window);
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
		<button type="submit">Find</button>
	</div>
	<span class="help" id="q-help">
		Part of an email or display name.
		{#if data.query.q}<a href={here}>Show all users</a>{/if}
	</span>
</form>

{#if data.users.length === 0}
	{#if w.outOfRange}
		<p class="empty">
			There's no page {count(data.query.page)}.
			<a href="{here}{pageSearch(1)}">Go to page 1</a>
		</p>
	{:else if data.query.q}
		<p class="empty">No users match "{data.query.q}".</p>
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
				{#if data.showLastSignIn}<th scope="col">Last sign-in</th>{/if}
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
					{#if data.showLastSignIn}
						<td data-label="Last sign-in" class="when">
							{#if u.lastSignInAt}
								<time datetime={u.lastSignInAt}>{stamp(u.lastSignInAt)}</time>
							{:else}
								<span class="muted">Never</span>
							{/if}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if w.hasPrevious || w.hasNext}
	<nav class="pages" aria-label="Pages">
		{#if w.hasPrevious}<a href="{here}{pageSearch(data.query.page - 1)}" rel="prev">Previous</a
			>{/if}
		<span class="readout"
			><span>page <b>{count(data.query.page)}</b> of <b>{count(w.pageCount)}</b></span></span
		>
		{#if w.hasNext}<a href="{here}{pageSearch(data.query.page + 1)}" rel="next">Next</a>{/if}
	</nav>
{/if}

<style>
	.find {
		display: grid;
		gap: 0.375rem;
		max-width: 32rem;
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
