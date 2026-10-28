<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const links = [
		{ href: resolve('/(app)/admin'), label: 'Orgs' },
		{ href: resolve('/(app)/admin/users'), label: 'Users' }
	];
</script>

<nav aria-label="Platform admin">
	{#each links as link, i (link.href)}
		{#if i > 0}<span aria-hidden="true">·</span>{/if}
		<a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}
			>{link.label}</a
		>
	{/each}
</nav>

<style>
	nav {
		display: flex;
		gap: 0.5rem;
		font-size: 0.9375rem;
		color: var(--color-muted);
	}
	a[aria-current] {
		color: var(--color-ink);
		font-weight: 500;
		text-decoration: none;
	}
</style>
