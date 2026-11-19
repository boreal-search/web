<!--
	The app shell: sidebar | content. Wide screens: a sticky full-height column the viewer can
	collapse to a narrow rail (remembered in a cookie, so the server paints it). Phones (≤ 760px):
	a top bar whose Menu button opens the sidebar as a drawer.
-->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Modal from '#lib/components/Modal.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import { rememberSidebar } from '#lib/components/search/layout-prefs.js';
	import Sidebar from './Sidebar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const initial = () => data.sidebarCollapsed;
	let collapsed = $state(initial());
	let drawerOpen = $state(false);
	let opener = $state<HTMLButtonElement>();
	afterNavigate(() => (drawerOpen = false));

	function toggle() {
		collapsed = !collapsed;
		rememberSidebar(collapsed);
	}
	// The search screen sets its own measures across the whole content area.
	let wide = $derived(page.route.id === '/(app)/search');
	const searchHref = resolve('/(app)/search');
	/** The rail names the org only when there is a choice (the expanded sidebar switches it). */
	let railOrg = $derived(
		data.nav && data.nav.contexts.length > 1 ? data.nav.contexts.find((c) => c.current) : null
	);
</script>

{#snippet newSearch()}
	<a class="button quiet icon" href={searchHref} title="New search">
		<span aria-hidden="true">+</span><span class="sr-only">New search</span>
	</a>
{/snippet}

<div class={['shell', collapsed && 'collapsed']}>
	<aside id="app-sidebar" class="rail" aria-label="Sidebar">
		<div class="rail-head">
			{#if !collapsed}<a class="wordmark" href={searchHref}>boreal</a>{/if}
			<button
				type="button"
				class="quiet icon"
				aria-expanded={!collapsed}
				aria-controls="app-sidebar"
				title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
				onclick={toggle}
			>
				<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
					<rect x="2.5" y="3.5" width="15" height="13" fill="none" stroke="currentColor" />
					<line x1="7.5" y1="3.5" x2="7.5" y2="16.5" stroke="currentColor" />
				</svg>
				<span class="sr-only">{collapsed ? 'Show sidebar' : 'Hide sidebar'}</span>
			</button>
		</div>
		{#if collapsed}
			{@render newSearch()}
			{#if data.user && data.nav}
				<div class="rail-foot">
					{#if railOrg}
						<button
							type="button"
							class="quiet icon org"
							title="Org: {railOrg.label}. Show sidebar to switch"
							onclick={toggle}
						>
							<span aria-hidden="true">{railOrg.label.charAt(0).toUpperCase()}</span>
							<span class="sr-only">Org: {railOrg.label}. Show sidebar to switch</span>
						</button>
					{/if}
					<UserMenu
						compact
						email={data.user.email}
						isPlatformAdmin={data.nav.isPlatformAdmin}
						adminOrgs={data.nav.adminOrgs}
						theme={data.theme}
					/>
				</div>
			{/if}
		{:else}
			<Sidebar {data} />
		{/if}
	</aside>

	<div class="content">
		<header class="phone-bar">
			<button
				type="button"
				class="quiet icon"
				bind:this={opener}
				aria-haspopup="dialog"
				aria-expanded={drawerOpen}
				onclick={() => (drawerOpen = true)}
			>
				<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
					<path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" fill="none" />
				</svg>
				<span class="sr-only">Menu</span>
			</button>
			<a class="wordmark" href={searchHref}>boreal</a>
			{@render newSearch()}
		</header>
		<main id="main" tabindex="-1" class={{ wide }}>
			{@render children()}
		</main>
	</div>
</div>

<Modal bind:open={drawerOpen} title="Menu" drawer onclose={() => opener?.focus()}>
	{#if drawerOpen}<Sidebar {data} onpick={() => (drawerOpen = false)} />{/if}
</Modal>

<style>
	.shell {
		--rail: 16rem;
		display: grid;
		grid-template-columns: var(--rail) minmax(0, 1fr);
		min-height: 100dvh;
	}
	.shell.collapsed {
		--rail: 3.5rem;
	}
	.rail {
		position: sticky;
		top: 0;
		box-sizing: border-box;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 0.75rem 1rem;
		padding-left: max(1rem, env(safe-area-inset-left));
		background: var(--color-sidebar);
		border-right: 1px solid var(--color-rule);
	}
	.collapsed .rail {
		align-items: center;
		gap: 0.5rem;
		padding-inline: 0.375rem;
	}
	.rail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
	.wordmark {
		font-weight: 700;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
		color: var(--color-ink);
		text-decoration: none;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		min-height: 2.75rem;
		padding: 0;
		color: var(--color-muted);
		font: 500 1.25rem/1 var(--font-mono);
		text-decoration: none;
	}
	.icon:hover {
		color: var(--color-ink);
	}
	.rail-foot {
		display: grid;
		justify-items: center;
		align-self: stretch;
		gap: 0.25rem;
		margin-top: auto;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-rule);
	}
	.org span[aria-hidden] {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--color-edge);
		border-radius: 3px;
		font: 600 0.875rem/1 var(--font-sans);
		color: var(--color-ink);
	}
	.content {
		min-width: 0;
	}
	main:focus {
		outline: none;
	}
	main.wide {
		max-width: none;
		padding-bottom: 0;
	}
	.phone-bar {
		display: none;
	}
	@media (max-width: 47.5rem) {
		.shell {
			display: block;
		}
		.rail {
			display: none;
		}
		.phone-bar {
			position: sticky;
			top: 0;
			z-index: 4;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0.25rem max(0.25rem, env(safe-area-inset-right)) 0.25rem
				max(0.25rem, env(safe-area-inset-left));
			background: var(--color-page);
			border-bottom: 1px solid var(--color-rule);
		}
		main {
			padding-top: 1.25rem;
		}
	}
</style>
