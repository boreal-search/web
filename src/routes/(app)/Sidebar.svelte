<!--
	The app sidebar's body: New search and the context switcher, the context's trails, then the
	user menu at the foot. Shown as a column on wide screens and inside the drawer on phones.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ContextSwitch from '#lib/components/ContextSwitch.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import TrailList from './TrailList.svelte';
	import type { LayoutData } from './$types';

	let { data, onpick }: { data: LayoutData; onpick?: () => void } = $props();

	// Back to the same page after switching; a data source may not exist in the new context.
	let switchBackTo = $derived(
		page.route.id === '/(app)/data-sources/[id]'
			? resolve('/(app)/data-sources')
			: page.url.pathname
	);
</script>

<div class="sidebar">
	<div class="top">
		<a class="button new" href={resolve('/(app)/search')} onclick={onpick}>
			<span aria-hidden="true">+</span> New search
		</a>
		{#if data.nav}
			<ContextSwitch contexts={data.nav.contexts} label="Org" redirectTo={switchBackTo} />
		{/if}
	</div>
	<nav class="trails" aria-label="Trails">
		<TrailList trails={data.trails} view={data.trailView} {onpick} />
	</nav>
	{#if data.user && data.nav}
		<div class="foot">
			<UserMenu
				email={data.user.email}
				isPlatformAdmin={data.nav.isPlatformAdmin}
				adminOrgs={data.nav.adminOrgs}
				theme={data.theme}
			/>
		</div>
	{/if}
</div>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.top {
		display: grid;
		gap: 1rem;
		padding-bottom: 1rem;
	}
	.new {
		justify-content: flex-start;
		gap: 0.5rem;
		width: 100%;
	}
	.new span {
		font: 500 1.125rem/1 var(--font-mono);
	}
	.trails {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1rem 0.5rem;
		margin-inline: -0.5rem;
		border-top: 1px solid var(--color-rule);
	}
	.foot {
		padding-top: 0.5rem;
		margin-inline: -0.5rem;
		border-top: 1px solid var(--color-rule);
	}
</style>
