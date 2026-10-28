<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import '@fontsource-variable/schibsted-grotesk';
	import '@fontsource-variable/source-serif-4';
	import '@fontsource-variable/jetbrains-mono';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	// Back to the same page after switching; a data source page may not exist in the new context.
	let switchBackTo = $derived(
		page.route.id === '/(app)/data-sources/[id]' ? '/' : page.url.pathname
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Boreal Search</title>
</svelte:head>

<header class="site">
	<strong><a href={resolve('/(app)')}>Boreal</a></strong>
	<nav aria-label="Primary">
		{#if data.nav}
			<a href={resolve('/(app)')}>Data sources</a>
			<a href={resolve('/(app)/search')}>Search</a>
			{#each data.nav.adminOrgs as org (org.slug)}
				<a href={resolve('/(app)/orgs/[slug]/manage', { slug: org.slug })}>Manage {org.name}</a>
			{/each}
			{#if data.nav.isPlatformAdmin}
				<a href={resolve('/(app)/admin')}>Platform admin</a>
			{/if}
			<a href={resolve('/(app)/account')}>Account</a>
		{/if}
	</nav>
	{#if data.nav && data.nav.contexts.length > 0}
		<form method="POST" action={resolve('/switch-org')}>
			<input type="hidden" name="redirectTo" value={switchBackTo} />
			<label>
				Searching in
				<select name="org">
					{#each data.nav.contexts as c (c.value)}
						<option value={c.value} selected={c.current}>{c.label}</option>
					{/each}
				</select>
			</label>
			<button type="submit">Switch</button>
		</form>
	{/if}
	{#if data.user}
		<span class="muted">{data.user.email}</span>
		<form method="POST" action={resolve('/logout')}>
			<button type="submit">Log out</button>
		</form>
	{:else}
		<a href={resolve('/login')}>Log in</a>
	{/if}
</header>

<main>
	{@render children()}
</main>
