<!--
	What can be done with a trail: export (anyone who can read it; works for trails that were never
	stored), and for the owner of a stored trail rename and delete. Delete posts to the search
	page's action.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		trailFileName,
		trailJson,
		trailMarkdown,
		type TrailExportMeta
	} from '#lib/trail-export.js';
	import type { TrailStep } from '#lib/trail.js';

	let {
		title,
		steps,
		trail,
		email,
		context,
		renaming,
		onrename
	}: {
		title: string;
		steps: readonly TrailStep[];
		/** The stored trail, when this is one. */
		trail: { id: string; isOwner: boolean } | null;
		/** Who exports, and the context name, for the export header. */
		email: string;
		context: string;
		renaming: boolean;
		onrename: () => void;
	} = $props();

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
	}
</script>

<div class="actions">
	{#if trail?.isOwner && !renaming}
		<button type="button" class="quiet" onclick={onrename}>Rename</button>
	{/if}
	<span class="export">
		<span class="muted">Export</span>
		<button type="button" class="quiet" onclick={() => download('md')}>Markdown</button>
		<button type="button" class="quiet" onclick={() => download('json')}>JSON</button>
	</span>
	{#if trail?.isOwner}
		<form
			method="POST"
			action="?/delete"
			use:enhance={({ cancel }) => {
				if (!confirm(`Delete the trail "${title}"? This can't be undone.`)) cancel();
			}}
		>
			<input type="hidden" name="trail_id" value={trail.id} />
			<button type="submit" class="danger">Delete trail</button>
		</form>
	{/if}
</div>

<style>
	.export {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
	}
	.export .muted {
		font-size: 0.9375rem;
	}
</style>
