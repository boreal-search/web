<!--
	The search screen's outer layout: the trail sidebar beside the main content. Desktop: a
	sticky column the viewer can collapse to a narrow rail (remembered in a cookie). Until they
	choose, medium screens (< 80rem) start collapsed, by CSS so the server's paint is right. Phones
	(≤ 760px): no sidebar column; a "Trails" button opens the list as a full-screen modal.
-->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { rememberSidebar, type SidebarChoice } from './layout-prefs.js';
	import Modal from './Modal.svelte';
	import TrailSidebar, { type SidebarTrail } from './TrailSidebar.svelte';

	let {
		trails,
		currentId,
		sidebar,
		children
	}: {
		trails: readonly SidebarTrail[];
		/** The stored trail shown on the page, if any. */
		currentId: string | null;
		/** The viewer's remembered choice, from the load. */
		sidebar: SidebarChoice;
		children: Snippet;
	} = $props();

	const initial = () => sidebar;
	let choice = $state(initial());
	/** Medium screens: the sidebar starts collapsed (matches `.auto` in the CSS below). */
	const medium = new MediaQuery('max-width: 79.99rem', false);
	let collapsed = $derived(choice === null ? medium.current : choice === 'collapsed');
	let sheetOpen = $state(false);
	let opener = $state<HTMLButtonElement>();
	afterNavigate(() => (sheetOpen = false));

	function toggle() {
		const next = !collapsed;
		choice = next ? 'collapsed' : 'open';
		rememberSidebar(next);
	}
</script>

<div class={['search-shell', choice === 'collapsed' && 'collapsed', choice === null && 'auto']}>
	<aside class="rail" aria-label="Trails">
		<button
			type="button"
			class="quiet toggle"
			aria-expanded={!collapsed}
			aria-controls="trail-sidebar"
			title={collapsed ? 'Show trails' : 'Hide trails'}
			onclick={toggle}
		>
			<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
				<rect x="2.5" y="3.5" width="15" height="13" fill="none" stroke="currentColor" />
				<line x1="7.5" y1="3.5" x2="7.5" y2="16.5" stroke="currentColor" />
			</svg>
			<span class="sr-only">{collapsed ? 'Show trails' : 'Hide trails'}</span>
		</button>
		<!-- Both are rendered; the CSS shows the one for the state (unset: by screen width). -->
		<a class="button quiet toggle new" href={resolve('/(app)/search')} title="New search">
			<span aria-hidden="true">+</span><span class="sr-only">New search</span>
		</a>
		<div id="trail-sidebar">
			<TrailSidebar {trails} {currentId} />
		</div>
	</aside>

	<div class="main">
		<div class="phone-bar">
			<button type="button" bind:this={opener} onclick={() => (sheetOpen = true)}>
				<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
					<path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" fill="none" />
				</svg>
				Trails
			</button>
			<a class="button" href={resolve('/(app)/search')}>
				<span aria-hidden="true">+</span> New search
			</a>
		</div>
		{@render children()}
	</div>
</div>

<Modal bind:open={sheetOpen} title="Trails" full onclose={() => opener?.focus()}>
	<TrailSidebar {trails} {currentId} heading={false} onpick={() => (sheetOpen = false)} />
</Modal>

<style>
	/* The search screen widens the site's column (header and footer follow); its panes set their
	   own measures and run down to the footer. */
	:global(:root:has(.search-shell)) {
		--column: 112rem;
	}
	:global(main:has(.search-shell)) {
		padding-top: 0;
	}
	:global(main:has(.panes)) {
		padding-bottom: 0;
	}
	.search-shell {
		--rail: 15rem;
		position: relative;
		isolation: isolate;
		display: grid;
		grid-template-columns: var(--rail) minmax(0, 1fr);
		gap: 0 1.5rem;
		align-items: start;
	}
	.search-shell.collapsed {
		--rail: 2.75rem;
	}
	/* The sidebar's own shade, from the screen's left edge down the whole screen. */
	.search-shell::before {
		content: '';
		position: absolute;
		z-index: -1;
		inset: 0 auto 0 calc(-1 * max(1rem, env(safe-area-inset-left)));
		width: calc(var(--rail) + max(1rem, env(safe-area-inset-left)));
		border-right: 1px solid var(--color-rule);
		background: var(--color-sidebar);
	}
	.main {
		padding-top: 2rem;
	}
	.rail .new,
	.collapsed #trail-sidebar {
		display: none;
	}
	.collapsed .rail .new {
		display: inline-flex;
	}
	@media (max-width: 79.99rem) {
		.search-shell.auto {
			--rail: 2.75rem;
		}
		.auto #trail-sidebar {
			display: none;
		}
		.auto .rail .new {
			display: inline-flex;
		}
		.auto .rail {
			padding-right: 0;
			align-items: flex-start;
		}
	}
	.rail {
		position: sticky;
		top: 0;
		max-height: calc(100dvh - var(--site-footer));
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 2rem 1rem 1rem 0;
	}
	.collapsed .rail {
		padding-right: 0;
		align-items: flex-start;
	}
	.toggle {
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
	.toggle:hover {
		color: var(--color-ink);
	}
	.phone-bar {
		display: none;
	}
	@media (max-width: 47.5rem) {
		.search-shell,
		.search-shell.collapsed,
		.search-shell.auto {
			display: block;
		}
		.rail,
		.search-shell::before {
			display: none;
		}
		.phone-bar {
			display: flex;
			justify-content: space-between;
			gap: 0.75rem;
			margin-bottom: 1rem;
		}
		.phone-bar button,
		.phone-bar a {
			gap: 0.5rem;
		}
	}
</style>
