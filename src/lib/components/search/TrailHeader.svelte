<!--
	The trail's header: title (renamed in place by its owner), its context chip and, at the top
	right, the "⋯" menu (rename, share, export, delete). Below: who shared it, for a reader, and
	the last trail action's outcome. The rename form posts to the search page's action.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { TrailStep } from '#lib/trail.js';
	import TrailMenu from './TrailMenu.svelte';
	import type { StoredTrail } from './TrailShare.svelte';

	let {
		title,
		steps,
		stored,
		email,
		context,
		notice = null
	}: {
		title: string;
		steps: readonly TrailStep[];
		/** The stored trail as loaded, when this is one; null for a trail only in the page. */
		stored: StoredTrail | null;
		/** Who exports, and the context name (the chip, and the export header). */
		email: string;
		context: string;
		/** The last trail action's outcome. */
		notice?: string | null;
	} = $props();

	let renaming = $state(false);
	let owner = $derived(stored?.people.find((p) => p.relation === 'owner') ?? null);
</script>

<div class="trail-head">
	<div class="title">
		{#if renaming && stored}
			<form
				method="POST"
				action="?/rename"
				class="rename"
				use:enhance={() =>
					async ({ result, update }) => {
						await update({ reset: false, navigate: false });
						if (result.type === 'success') renaming = false;
					}}
			>
				<input type="hidden" name="trail_id" value={stored.id} />
				<label for="trail-title" class="sr-only">Trail title</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input id="trail-title" name="title" value={title} required maxlength="500" autofocus />
				<button type="submit" class="primary">Save</button>
				<button type="button" class="quiet" onclick={() => (renaming = false)}>Cancel</button>
			</form>
		{:else}
			<h2 id="trail-heading">{title}</h2>
		{/if}
		<span class="chip" title="Searched in {context}">{context}</span>
	</div>

	<TrailMenu
		{title}
		{steps}
		trail={stored}
		{email}
		{context}
		{notice}
		onrename={() => (renaming = true)}
	/>
</div>

{#if stored && !stored.isOwner}
	<p class="note">
		Shared by {owner ? (owner.display_name ?? owner.email) : 'its owner'} · read-only
	</p>
{/if}

{#if notice}<p class="notice" role="status">{notice}</p>{/if}

<style>
	.trail-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}
	.title {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.75rem;
		min-width: 0;
		padding-top: 0.375rem;
	}
	.title h2 {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.chip {
		flex: none;
		max-width: 16rem;
		padding: 0.0625rem 0.5rem;
		border: 1px solid var(--color-rule);
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rename {
		display: flex;
		flex: 1 1 24rem;
		gap: 0.5rem;
	}
	.rename input[name='title'] {
		flex: 1;
		min-width: 0;
	}
	.note {
		margin: 0 0 0.75rem;
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
	}
	.notice {
		margin-bottom: 0.75rem;
	}
</style>
