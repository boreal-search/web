<!-- The masthead's account corner: the signed-in user's menu (Account, Log out), else Log in / Sign up. -->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { user }: { user: { email?: string } | null } = $props();
	let menuOpen = $state(false);
	afterNavigate(() => (menuOpen = false));

	/** `page` on the item's own page, `true` on pages under it. */
	function current(href: string, section = false): 'page' | 'true' | undefined {
		if (page.url.pathname === href) return 'page';
		return section ? 'true' : undefined;
	}
	let route = $derived(page.route.id ?? '');
</script>

<div class="account">
	{#if user}
		<details class="menu" bind:open={menuOpen}>
			<summary title={user.email}>
				<span class="sr-only">Account menu for</span>
				<span class="email">{user.email}</span>
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

<style>
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

	@media (max-width: 40rem) {
		.email {
			max-width: 11rem;
		}
	}
</style>
