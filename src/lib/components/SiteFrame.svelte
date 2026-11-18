<!--
	Pages outside the app shell (sign-in pages, platform admin, errors): a header with the
	wordmark and, signed in, a way back to search and the user menu; else Log in / Request access.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import type { Theme } from '#lib/theme.js';
	import UserMenu from './UserMenu.svelte';

	let {
		user,
		nav,
		theme,
		children
	}: {
		user: { email?: string } | null;
		nav: { isPlatformAdmin: boolean; adminOrgs: { slug: string; name: string }[] } | null;
		theme: Theme;
		children: Snippet;
	} = $props();

	const login = resolve('/(site)/login');
</script>

<header class="site">
	<div class="masthead">
		<a class="wordmark" href={resolve('/')}>boreal</a>
		<div class="end">
			{#if user && nav}
				<a href={resolve('/(app)/search')}>Back to search</a>
				<div class="menu">
					<UserMenu
						email={user.email}
						isPlatformAdmin={nav.isPlatformAdmin}
						adminOrgs={nav.adminOrgs}
						{theme}
					/>
				</div>
			{:else}
				<a href={login} aria-current={page.url.pathname === login ? 'page' : undefined}>Log in</a>
				<a class="button primary" href={resolve('/(site)/signup')}>Request access</a>
			{/if}
		</div>
	</div>
</header>

<main id="main" tabindex="-1">
	{@render children()}
</main>

<footer class="site">
	<p>Designed in Vancouver, BC</p>
</footer>

<style>
	header.site {
		border-bottom: 1px solid var(--color-rule);
	}
	.masthead,
	footer.site p {
		max-width: var(--column);
		margin-inline: auto;
		padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
	}
	.masthead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 3.5rem;
	}
	.wordmark {
		font-weight: 700;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
		color: var(--color-ink);
		text-decoration: none;
	}
	.end {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}
	.end > a:not(.button) {
		color: var(--color-muted);
		white-space: nowrap;
	}
	.end > a:not(.button):hover,
	.end > a[aria-current] {
		color: var(--color-ink);
	}
	.menu {
		min-width: 0;
		max-width: 16rem;
	}
	main:focus {
		outline: none;
	}
	footer.site {
		padding: 1.5rem 0 2rem;
		border-top: 1px solid var(--color-rule);
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
	}
	footer.site p {
		margin-block: 0;
	}
	@media (max-width: 40rem) {
		.menu {
			max-width: 9rem;
		}
	}
</style>
