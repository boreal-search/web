<!--
	The trail's title (renamed in place by its owner), its menu, who can read it, and the last
	trail action's outcome. The rename form posts to the search page's action.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { TrailStep } from '#lib/trail.js';
	import TrailMenu from './TrailMenu.svelte';
	import TrailShare, { type StoredTrail } from './TrailShare.svelte';

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
		/** Who exports, and the context name, for the export header. */
		email: string;
		context: string;
		/** The last trail action's outcome. */
		notice?: string | null;
	} = $props();

	let renaming = $state(false);
</script>

<div class="trail-head">
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

	<TrailMenu
		{title}
		{steps}
		trail={stored}
		{email}
		{context}
		{renaming}
		onrename={() => (renaming = true)}
	/>
</div>

{#if stored}<TrailShare trail={stored} />{/if}

{#if notice}<p class="notice" role="status">{notice}</p>{/if}

<style>
	.trail-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		margin-bottom: 0.5rem;
	}
	.trail-head h2 {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
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
	.notice {
		margin-bottom: 0.75rem;
	}
</style>
