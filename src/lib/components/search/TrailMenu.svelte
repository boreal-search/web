<!--
	The trail's "⋯" menu: export (anyone who can read it; works for trails that were never stored),
	and for the owner of a stored trail rename, share and delete. Share and the delete
	confirmation open as modals; their forms post to the search page's actions.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import {
		trailFileName,
		trailJson,
		trailMarkdown,
		type TrailExportMeta
	} from '#lib/trail-export.js';
	import type { TrailStep } from '#lib/trail.js';
	import Modal from './Modal.svelte';
	import TrailShare, { type StoredTrail } from './TrailShare.svelte';

	let {
		title,
		steps,
		trail,
		email,
		context,
		notice = null,
		onrename
	}: {
		title: string;
		steps: readonly TrailStep[];
		/** The stored trail, when this is one. */
		trail: StoredTrail | null;
		/** Who exports, and the context name, for the export header. */
		email: string;
		context: string;
		/** The last trail action's outcome (shown in the Share modal too). */
		notice?: string | null;
		onrename: () => void;
	} = $props();

	const id = $props.id();
	let open = $state(false);
	let sharing = $state(false);
	let deleting = $state(false);
	let button = $state<HTMLButtonElement>();
	let menu = $state<HTMLElement>();
	let owner = $derived(trail?.isOwner ? trail : null);

	const items = () => [...(menu?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];

	async function show() {
		open = true;
		await tick();
		items()[0]?.focus();
	}

	function close(refocus = true) {
		open = false;
		if (refocus) button?.focus();
	}

	/** Arrow keys move between items; Escape closes; Tab leaves (and closes). */
	function onkeydown(e: KeyboardEvent) {
		const all = items();
		const at = all.indexOf(document.activeElement as HTMLElement);
		const go = (i: number) => all[(i + all.length) % all.length]?.focus();
		if (e.key === 'ArrowDown') go(at + 1);
		else if (e.key === 'ArrowUp') go(at - 1);
		else if (e.key === 'Home') go(0);
		else if (e.key === 'End') go(all.length - 1);
		else if (e.key === 'Escape') close();
		else if (e.key === 'Tab') return close(false);
		else return;
		e.preventDefault();
	}

	/** Pick an item: close the menu without refocusing, since the item may move focus. */
	const pick = (run: () => void) => () => {
		close(false);
		run();
	};

	function download(kind: 'md' | 'json') {
		const meta: TrailExportMeta = {
			title,
			exported_at: new Date().toISOString(),
			email,
			context,
			origin: location.origin
		};
		const body = kind === 'md' ? trailMarkdown(meta, steps) : trailJson(meta, steps);
		const type = kind === 'md' ? 'text/markdown' : 'application/json';
		const url = URL.createObjectURL(new Blob([body], { type: `${type};charset=utf-8` }));
		const a = document.createElement('a');
		a.href = url;
		a.download = trailFileName(title, meta.exported_at, kind);
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		button?.focus();
	}
</script>

<svelte:window
	onclick={(e) => {
		if (open && !(e.target instanceof Node && button?.parentElement?.contains(e.target)))
			close(false);
	}}
/>

<div class="trail-menu">
	<button
		type="button"
		class="quiet more"
		bind:this={button}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls="{id}-menu"
		onclick={() => (open ? close() : show())}
	>
		<span aria-hidden="true">⋯</span><span class="sr-only">Trail actions</span>
	</button>

	{#if open}
		<div
			id="{id}-menu"
			role="menu"
			tabindex="-1"
			aria-label="Trail actions"
			bind:this={menu}
			{onkeydown}
		>
			{#if owner}
				<button type="button" role="menuitem" tabindex="-1" onclick={pick(onrename)}>Rename</button>
				<button type="button" role="menuitem" tabindex="-1" onclick={pick(() => (sharing = true))}>
					Share…
				</button>
			{/if}
			<button type="button" role="menuitem" tabindex="-1" onclick={pick(() => download('md'))}>
				Export Markdown
			</button>
			<button type="button" role="menuitem" tabindex="-1" onclick={pick(() => download('json'))}>
				Export JSON
			</button>
			{#if owner}
				<hr />
				<button type="button" role="menuitem" tabindex="-1" onclick={pick(() => (deleting = true))}>
					Delete trail…
				</button>
			{/if}
		</div>
	{/if}
</div>

{#if owner}
	<Modal bind:open={sharing} title="Share trail" onclose={() => button?.focus()}>
		<TrailShare trail={owner} />
		{#if notice}<p class="notice" role="status">{notice}</p>{/if}
	</Modal>

	<Modal bind:open={deleting} title="Delete trail" onclose={() => button?.focus()}>
		<p class="confirm">
			Delete “{title}” and its {steps.length}
			{steps.length === 1 ? 'step' : 'steps'}? People it's shared with lose it too. This can't be
			undone.
		</p>
		<form method="POST" action="?/delete" class="actions" use:enhance>
			<input type="hidden" name="trail_id" value={owner.id} />
			<button type="submit" class="danger">Delete trail</button>
			<button type="button" onclick={() => (deleting = false)}>Cancel</button>
		</form>
	</Modal>
{/if}

<style>
	.trail-menu {
		position: relative;
		flex: none;
	}
	.more {
		width: 2.75rem;
		min-height: 2.75rem;
		padding: 0;
		font-size: 1.375rem;
		line-height: 1;
		text-decoration: none;
		color: var(--color-muted);
	}
	.more:hover,
	.more[aria-expanded='true'] {
		color: var(--color-ink);
	}
	[role='menu'] {
		position: absolute;
		right: 0;
		top: calc(100% + 0.25rem);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 12rem;
		padding: 0.25rem 0;
		border: 1px solid var(--color-edge);
		background: var(--color-surface);
	}
	[role='menuitem'] {
		justify-content: flex-start;
		width: 100%;
		min-height: 2.5rem;
		padding: 0.375rem 0.875rem;
		border: 0;
		background: none;
		color: var(--color-ink);
		font-weight: 400;
		text-align: left;
	}
	[role='menuitem']:hover,
	[role='menuitem']:focus-visible {
		background: var(--color-page);
	}
	[role='menuitem']:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
	@media (max-width: 47.5rem) {
		[role='menuitem'] {
			min-height: 2.75rem;
		}
	}
	hr {
		margin: 0.25rem 0;
		border: 0;
		border-top: 1px solid var(--color-rule);
	}
	.confirm {
		margin: 0 0 1rem;
		overflow-wrap: anywhere;
	}
</style>
