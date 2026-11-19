<!--
	The sidebar's trail list: the current context's trails and those shared with the user, most
	recent first. Each reopens the trail; the one shown is marked. One line per trail: the title,
	cut with an ellipsis (whole title, context and date on hover), and a "shared" marker on
	trails someone else shared. "View all" lifts the TRAIL_LIMIT.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import { stamp } from '#lib/format.js';
	import type { LayoutData } from './$types';

	let {
		trails,
		view,
		onpick
	}: {
		trails: LayoutData['trails'];
		view: LayoutData['trailView'];
		/** A trail or "View all" chosen, before it navigates. */
		onpick?: () => void;
	} = $props();

	const id = $props.id();
	const searchHref = resolve('/(app)/search');
	/** Marked as soon as it's chosen, not once it has loaded. */
	let at = $derived(navigating.to ?? page);
	let currentId = $derived(
		at.route.id === '/(app)/search' ? at.url.searchParams.get('trail') : null
	);
	const trailHref = (trail: string) =>
		`${searchHref}?${new URLSearchParams({ trail, ...(view.all ? { all: '1' } : {}) })}`;
	let allHref = $derived(
		`${searchHref}?${new URLSearchParams({ all: '1', ...(currentId ? { trail: currentId } : {}) })}`
	);

	/** The row's tooltip: the whole title, then where and when (the row shows only the title). */
	const hint = (t: LayoutData['trails'][number]) =>
		`${t.title}\n${t.owned ? '' : 'Shared with you · '}${t.org_name ?? 'Public'} · ${stamp(t.updated_at)}`;
</script>

<h2 class="label" id="{id}-heading">Trails</h2>
{#if trails.length === 0}
	<p class="empty-note">No trails yet. Each search starts one.</p>
{:else}
	<ul aria-labelledby="{id}-heading">
		{#each trails as t (t.id)}
			<li>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus params -->
				<a
					href={trailHref(t.id)}
					title={hint(t)}
					aria-current={t.id === currentId ? 'page' : undefined}
					onclick={onpick}
				>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<span class="title">{t.title}</span>
					{#if !t.owned}<span class="shared">shared<span class="sr-only"> with you</span></span
						>{/if}
				</a>
			</li>
		{/each}
	</ul>
	{#if view.more}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus params -->
		<a class="button quiet all" href={allHref} onclick={onpick}>View all</a>
	{/if}
{/if}

<style>
	.label {
		margin: 0;
		font: 400 0.75rem/1.4 var(--font-mono);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.all {
		align-self: flex-start;
		font-size: 0.875rem;
	}
	.empty-note {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	ul {
		list-style: none;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1px;
		margin: 0 -0.5rem;
		padding: 0;
	}
	li a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2rem;
		padding: 0.25rem 0.5rem;
		color: var(--color-ink);
		font-size: 0.875rem;
		line-height: 1.4;
		text-decoration: none;
	}
	li a:hover {
		background: var(--color-surface);
	}
	li a[aria-current='page'] {
		background: var(--color-surface);
		box-shadow: inset 2px 0 0 var(--color-ink);
		font-weight: 600;
	}
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.shared {
		flex: none;
		font: 400 0.6875rem/1 var(--font-mono);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
