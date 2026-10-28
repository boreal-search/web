<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import '@fontsource-variable/schibsted-grotesk';
	import '@fontsource-variable/source-serif-4';
	import '@fontsource-variable/jetbrains-mono';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let menuOpen = $state(false);
	afterNavigate(() => (menuOpen = false));

	// Back to the same page after switching; a data source page may not exist in the new context.
	let switchBackTo = $derived(
		page.route.id === '/(app)/data-sources/[id]' ? '/' : page.url.pathname
	);
	let contextName = $derived(
		data.access
			? data.access.context.kind === 'org'
				? data.access.context.org.name
				: 'Public'
			: null
	);

	/** `page` on the item's own page, `true` on pages under it (a data source under Data sources). */
	function current(href: string, section = false): 'page' | 'true' | undefined {
		if (page.url.pathname === href) return 'page';
		return section ? 'true' : undefined;
	}
	let route = $derived(page.route.id ?? '');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Boreal Search</title>
</svelte:head>

<a class="skip" href="#main">Skip to content</a>

<header class="site">
	<div class="masthead">
		<a class="wordmark" href={resolve('/(app)')}>boreal</a>

		{#if data.nav}
			<nav aria-label="Primary">
				<ul>
					<li>
						<a
							href={resolve('/(app)')}
							aria-current={current(resolve('/(app)'), route === '/(app)/data-sources/[id]')}
							>Data sources</a
						>
					</li>
					<li>
						<a href={resolve('/(app)/search')} aria-current={current(resolve('/(app)/search'))}
							>Search</a
						>
					</li>
					{#each data.nav.adminOrgs as org (org.slug)}
						{@const href = resolve('/(app)/orgs/[slug]/manage', { slug: org.slug })}
						<li>
							<a {href} aria-current={current(href)} title="Manage {org.name}">Manage {org.name}</a>
						</li>
					{/each}
					{#if data.nav.isPlatformAdmin}
						<li>
							<a href={resolve('/(app)/admin')} aria-current={current(resolve('/(app)/admin'))}
								>Platform admin</a
							>
						</li>
					{/if}
				</ul>
			</nav>
		{/if}

		<div class="account">
			{#if data.user}
				<details class="menu" bind:open={menuOpen}>
					<summary title={data.user.email}>
						<span class="sr-only">Account menu for</span>
						<span class="email">{data.user.email}</span>
					</summary>
					<div class="panel">
						<a
							href={resolve('/(app)/account')}
							aria-current={current(resolve('/(app)/account'), route === '/account/password')}
							>Account</a
						>
						<form method="POST" action={resolve('/logout')}>
							<button type="submit" class="quiet">Log out</button>
						</form>
					</div>
				</details>
			{:else}
				<a href={resolve('/login')} aria-current={current(resolve('/login'))}>Log in</a>
				<a class="button primary" href={resolve('/signup')}>Sign up</a>
			{/if}
		</div>
	</div>

	{#if data.nav && contextName}
		<div class="context">
			{#if data.nav.contexts.length > 0}
				<form method="POST" action={resolve('/switch-org')}>
					<input type="hidden" name="redirectTo" value={switchBackTo} />
					<label for="context-switch">Searching in</label>
					<select id="context-switch" name="org">
						{#each data.nav.contexts as c (c.value)}
							<option value={c.value} selected={c.current}>{c.label}</option>
						{/each}
					</select>
					<button type="submit">Switch</button>
				</form>
			{:else}
				<p>Searching in <b>{contextName}</b></p>
			{/if}
		</div>
	{/if}
</header>

<main id="main" tabindex="-1">
	{@render children()}
</main>

<footer class="site">
	<p>Designed in Vancouver, BC</p>
</footer>

<style>
	.skip {
		position: absolute;
		left: 1rem;
		top: -4rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-surface);
		z-index: 10;
	}
	.skip:focus {
		top: 0.5rem;
	}

	header.site {
		border-bottom: 1px solid var(--color-rule);
	}
	/* One column edge for header, context row, footer and main (app.css): rules run full-bleed,
	   content sits in the 72rem column with the same gutters. */
	.masthead,
	.context > *,
	footer.site p {
		max-width: 72rem;
		margin-inline: auto;
		padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
	}
	.masthead {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas: 'mark nav account';
		align-items: center;
		gap: 0 2rem;
		min-height: 3.5rem;
	}

	.wordmark {
		grid-area: mark;
		font-weight: 700;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
		color: var(--color-ink);
		text-decoration: none;
	}

	nav {
		grid-area: nav;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	nav ul {
		display: flex;
		gap: 1.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	nav a {
		display: block;
		max-width: 16rem;
		padding: 1rem 0 calc(1rem - 2px);
		border-bottom: 2px solid transparent;
		color: var(--color-muted);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	nav a:hover {
		color: var(--color-ink);
	}
	nav a[aria-current] {
		color: var(--color-ink);
		border-bottom-color: var(--color-ink);
	}

	.account {
		grid-area: account;
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
		justify-self: end;
	}
	.menu {
		position: relative;
		min-width: 0;
	}
	.menu summary {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 2.75rem;
		padding: 0;
		color: var(--color-muted);
		font-weight: 400;
		list-style: none;
	}
	.menu summary::-webkit-details-marker {
		display: none;
	}
	.menu summary::after {
		content: '';
		flex: none;
		width: 0.4em;
		height: 0.4em;
		margin-top: -0.2em;
		border: solid currentColor;
		border-width: 0 1px 1px 0;
		rotate: 45deg;
	}
	.menu[open] summary,
	.menu summary:hover {
		color: var(--color-ink);
	}
	.email {
		display: block;
		max-width: 18rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.panel {
		position: absolute;
		right: 0;
		top: 100%;
		z-index: 5;
		display: grid;
		min-width: 11rem;
		padding: 0.25rem 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-rule);
	}
	.panel > a,
	.panel button {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		width: 100%;
		padding: 0;
		justify-content: flex-start;
		border-bottom: 1px solid var(--color-rule);
	}
	.panel > a {
		color: var(--color-ink);
		text-decoration: none;
	}
	.panel > a[aria-current] {
		font-weight: 600;
	}
	.panel button {
		border: 0;
		color: var(--color-ink);
		text-decoration: none;
	}

	.context {
		border-top: 1px solid var(--color-rule);
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
	}
	.context form,
	.context p {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.75rem;
		margin-block: 0;
		min-height: 2.75rem;
		padding-block: 0.375rem;
	}
	.context b {
		color: var(--color-ink);
		font-weight: 500;
	}
	.context select {
		width: auto;
		max-width: min(20rem, 100%);
		min-height: 2.25rem;
		padding-block: 0.25rem;
		font-family: var(--font-sans);
		font-size: 0.9375rem;
	}
	.context button {
		min-height: 2.25rem;
		padding-block: 0.25rem;
		font-size: 0.875rem;
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
		.masthead {
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-areas:
				'mark account'
				'nav nav';
			gap: 0 1rem;
		}
		nav {
			margin-inline: calc(-1 * max(1rem, env(safe-area-inset-left)));
			padding-inline: max(1rem, env(safe-area-inset-left));
			border-top: 1px solid var(--color-rule);
		}
		nav ul {
			flex-wrap: wrap;
			column-gap: 1.25rem;
			row-gap: 0;
		}
		nav a {
			max-width: calc(100vw - 2rem);
			padding-block: 0.625rem calc(0.625rem - 2px);
		}
		.email {
			max-width: 11rem;
		}
	}
</style>
