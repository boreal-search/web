<!--
	The signed-in user's menu: a popover (Escape and outside clicks close it) beside its button,
	opening up or down, left or right, to stay on screen. Items follow the user's roles.
	`compact`: an icon button (the collapsed sidebar rail).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { beside } from '#lib/popover.js';
	import { THEMES, type Theme } from '#lib/theme.js';

	let {
		email,
		isPlatformAdmin,
		adminOrgs,
		theme,
		compact = false
	}: {
		email: string | undefined;
		isPlatformAdmin: boolean;
		adminOrgs: readonly { slug: string; name: string }[];
		theme: Theme;
		compact?: boolean;
	} = $props();

	const THEME_LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };
	const id = $props.id();
	let button = $state<HTMLButtonElement>();
	let menu = $state<HTMLElement>();
	let at = $state({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
	let themeFailed = $state(false);
	afterNavigate(() => menu?.hidePopover());

	function place(e: ToggleEvent) {
		if (e.newState !== 'open' || !button) return;
		at = beside(button.getBoundingClientRect(), { width: innerWidth, height: innerHeight });
	}

	const current = (href: string) => (page.url.pathname === href ? 'page' : undefined);
	const links = $derived([
		{ href: resolve('/(app)/data-sources'), label: 'Data sources' },
		...adminOrgs.map((o) => ({
			href: resolve('/(app)/orgs/[slug]/manage', { slug: o.slug }),
			label: `Manage ${o.name}`
		})),
		...(isPlatformAdmin ? [{ href: resolve('/(site)/admin'), label: 'Admin' }] : []),
		{ href: resolve('/(app)/account'), label: 'Account' }
	]);
</script>

<button
	type="button"
	class={['quiet trigger', compact && 'compact']}
	bind:this={button}
	popovertarget="{id}-menu"
	title={email}
>
	<span class="sr-only">Account menu for</span>
	{#if compact}
		<span class="sr-only">{email}</span>
		<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
			<circle cx="10" cy="7" r="3.5" fill="none" stroke="currentColor" />
			<path d="M3.5 17c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" fill="none" stroke="currentColor" />
		</svg>
	{:else}
		<span class="email">{email}</span>
		<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
			<path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" />
		</svg>
	{/if}
</button>

<div
	id="{id}-menu"
	class="menu"
	popover="auto"
	bind:this={menu}
	onbeforetoggle={place}
	style:top={at.top}
	style:bottom={at.bottom}
	style:left={at.left}
	style:right={at.right}
>
	<ul>
		{#each links as link (link.href)}
			<li><a href={link.href} aria-current={current(link.href)}>{link.label}</a></li>
		{/each}
	</ul>
	<form
		method="POST"
		action="{resolve('/(app)/account')}?/theme"
		use:enhance={() => {
			themeFailed = false;
			return async ({ result }) => {
				if (result.type === 'success') await invalidateAll();
				else themeFailed = true;
			};
		}}
	>
		<fieldset>
			<legend>Theme</legend>
			<div class="themes">
				{#each THEMES as t (t)}
					<button type="submit" name="theme" value={t} aria-pressed={theme === t}>
						{THEME_LABELS[t]}
					</button>
				{/each}
			</div>
			{#if themeFailed}
				<p class="failed" role="alert">Your theme couldn't be saved. Try again in a minute.</p>
			{/if}
		</fieldset>
	</form>
	<form method="POST" action={resolve('/logout')}>
		<button type="submit" class="quiet out">Sign out</button>
	</form>
</div>

<style>
	.trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		min-height: 2.75rem;
		padding: 0 0.5rem;
		justify-content: space-between;
		color: var(--color-ink);
		font-weight: 400;
		text-decoration: none;
	}
	.trigger:hover {
		background: var(--color-surface);
	}
	.trigger svg {
		flex: none;
		color: var(--color-muted);
	}
	.trigger.compact {
		justify-content: center;
		width: 2.75rem;
		padding: 0;
	}
	.trigger.compact:hover svg {
		color: var(--color-ink);
	}
	.email {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.menu {
		position: fixed;
		inset: unset;
		box-sizing: border-box;
		width: min(16rem, calc(100vw - 1rem));
		margin: 0;
		padding: 0.25rem 0;
		border: 1px solid var(--color-edge);
		background: var(--color-surface);
		color: var(--color-ink);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li a,
	.out {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 2.75rem;
		padding: 0 1rem;
		color: var(--color-ink);
		text-decoration: none;
		justify-content: flex-start;
	}
	li a {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	li a:hover,
	.out:hover {
		background: var(--color-page);
	}
	li a[aria-current] {
		font-weight: 600;
	}
	form {
		margin: 0;
		border-top: 1px solid var(--color-rule);
	}
	fieldset {
		margin: 0;
		padding: 0 1rem 0.75rem;
		border: 0;
	}
	legend {
		float: left;
		width: 100%;
		padding: 0.625rem 0 0.375rem;
		font: 400 0.75rem/1.4 var(--font-mono);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.themes {
		clear: both;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
	}
	.themes button {
		min-height: 2.25rem;
		padding: 0 0.25rem;
		font-size: 0.875rem;
	}
	.themes button + button {
		margin-left: -1px;
	}
	.themes button[aria-pressed='true'] {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-page);
	}
	.failed {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
	}
</style>
