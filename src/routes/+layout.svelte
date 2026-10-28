<script lang="ts">
	import { resolve } from '$app/paths';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Boreal Search</title>
</svelte:head>

<header class="site">
	<strong><a href={resolve('/(app)')}>Boreal</a></strong>
	<nav aria-label="Primary">
		{#if data.user}
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
