<!--
	The search screen's outer layout: the trail sidebar beside the main content. Desktop: a
	sticky column the viewer can collapse to a narrow rail (remembered in a cookie). Phones
	(≤ 760px): no sidebar column; a "Trails" button opens the list as a full-screen modal.
-->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { rememberSidebar } from './sidebar.js';
	import Modal from './Modal.svelte';
	import TrailSidebar, { type SidebarTrail } from './TrailSidebar.svelte';

	let {
		trails,
		currentId,
		collapsed: initialCollapsed,
		children
	}: {
		trails: readonly SidebarTrail[];
		/** The stored trail shown on the page, if any. */
		currentId: string | null;
		/** The viewer's remembered choice, from the load. */
		collapsed: boolean;
		children: Snippet;
	} = $props();

	const initial = () => initialCollapsed;
	let collapsed = $state(initial());
	let sheetOpen = $state(false);
	let opener = $state<HTMLButtonElement>();
	afterNavigate(() => (sheetOpen = false));

	function toggle() {
		collapsed = !collapsed;
		rememberSidebar(collapsed);
	}
</script>

<div class={['search-shell', { collapsed }]}>
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
		{#if collapsed}
			<a class="button quiet toggle" href={resolve('/(app)/search')} title="New search">
				<span aria-hidden="true">+</span><span class="sr-only">New search</span>
			</a>
		{:else}
			<div id="trail-sidebar">
				<TrailSidebar {trails} {currentId} />
			</div>
		{/if}
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
	:global(main:has(.panes)) {
		padding-bottom: 0;
	}
	.search-shell {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		gap: 0 1.5rem;
		align-items: start;
	}
	.search-shell.collapsed {
		grid-template-columns: 2.75rem minmax(0, 1fr);
	}
	.rail {
		position: sticky;
		top: 0;
		max-height: calc(100dvh - var(--site-footer));
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 1rem 1rem 0;
		border-right: 1px solid var(--color-rule);
		min-height: 60vh;
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
		.search-shell.collapsed {
			display: block;
		}
		.rail {
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
