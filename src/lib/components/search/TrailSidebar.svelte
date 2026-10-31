<!--
	The search screen's trail list: "New search" (an empty trail), then the user's trails and
	those shared with them, most recent first. Each reopens the trail; the one shown is marked.
	One line per trail: the title, cut with an ellipsis (whole title, context and date on hover),
	and a small "shared" marker on trails someone else shared.
-->
<script module lang="ts">
	export interface SidebarTrail {
		id: string;
		title: string;
		/** The org's name; null for Public. */
		org_name: string | null;
		updated_at: string;
		/** false: shared with the user by someone else. */
		owned: boolean;
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { stamp } from '#lib/format.js';

	let {
		trails,
		currentId,
		heading = true,
		onpick
	}: {
		trails: readonly SidebarTrail[];
		/** The trail shown on the page, if stored. */
		currentId: string | null;
		/** Show the "Trails" label (false inside the modal, whose title says it). */
		heading?: boolean;
		/** A link chosen ("New search" or a trail), before it navigates. */
		onpick?: () => void;
	} = $props();

	const id = $props.id();

	const searchHref = resolve('/(app)/search');
	const trailHref = (id: string) => `${searchHref}?trail=${id}`;
	/** The row's tooltip: the whole title, then where and when (the row shows only the title). */
	const hint = (t: SidebarTrail) =>
		`${t.title}\n${t.owned ? '' : 'Shared with you · '}${t.org_name ?? 'Public'} · ${stamp(t.updated_at)}`;
</script>

<div class="sidebar">
	<a class="button new" href={searchHref} onclick={onpick}>
		<span aria-hidden="true">+</span> New search
	</a>

	{#if heading}<h2 class="label" id="{id}-heading">Trails</h2>{/if}
	{#if trails.length === 0}
		<p class="empty-note">No trails yet. Each search starts one.</p>
	{:else}
		<ul
			aria-labelledby={heading ? `${id}-heading` : undefined}
			aria-label={heading ? undefined : 'Trails'}
		>
			{#each trails as t (t.id)}
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus ?trail= -->
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
	{/if}
</div>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.new {
		justify-content: flex-start;
		gap: 0.5rem;
		width: 100%;
	}
	.new span {
		font: 500 1.125rem/1 var(--font-mono);
	}
	.label {
		margin: 0.5rem 0 0;
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
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
