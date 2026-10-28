<!--
	The trail's title and what can be done with it: export (anyone who can read it; works for
	trails that were never stored), and for the owner of a stored trail rename, share read-only
	with members of its org, and delete. Forms post to the search page's actions.
-->
<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { trailJson, trailMarkdown, type TrailExportMeta } from '#lib/trail-export.js';
	import type { TrailStep } from '#lib/trail.js';
	import type { TrailRelation } from '#lib/supabase/types.js';

	interface StoredTrail {
		id: string;
		isOwner: boolean;
		/** null: the Public context. */
		org_id: string | null;
		people: {
			user_id: string;
			email: string;
			display_name: string | null;
			relation: TrailRelation;
		}[];
	}

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

	// Stay on this trail: by default a submission lands on the action's URL, without `?trail=`.
	const stay: SubmitFunction =
		() =>
		({ update }) =>
			update({ navigate: false });

	let renaming = $state(false);
	let owner = $derived(stored?.people.find((p) => p.relation === 'owner') ?? null);
	let shared = $derived(stored?.people.filter((p) => p.relation === 'shared') ?? []);
	let members = $derived(stored?.people.filter((p) => p.relation === 'member') ?? []);
	const who = (p: { email: string; display_name: string | null }) =>
		p.display_name ? `${p.display_name} (${p.email})` : p.email;

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
		a.download = `boreal-trail-${slug(title)}-${meta.exported_at.slice(0, 10)}.${kind}`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	const slug = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 48) || 'search';
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

	<div class="actions">
		{#if stored?.isOwner && !renaming}
			<button type="button" class="quiet" onclick={() => (renaming = true)}>Rename</button>
		{/if}
		<span class="export">
			<span class="muted">Export</span>
			<button type="button" class="quiet" onclick={() => download('md')}>Markdown</button>
			<button type="button" class="quiet" onclick={() => download('json')}>JSON</button>
		</span>
		{#if stored?.isOwner}
			<form
				method="POST"
				action="?/delete"
				use:enhance={({ cancel }) => {
					if (!confirm(`Delete the trail "${title}"? This can't be undone.`)) cancel();
				}}
			>
				<input type="hidden" name="trail_id" value={stored.id} />
				<button type="submit" class="danger">Delete trail</button>
			</form>
		{/if}
	</div>
</div>

{#if stored && !stored.isOwner}
	<p class="note">Shared by {owner ? who(owner) : 'its owner'} · read-only</p>
{:else if stored?.isOwner}
	<div class="share">
		{#if stored.org_id === null}
			<p class="note">Trails searched in Public can't be shared.</p>
		{:else}
			{#if shared.length > 0}
				<ul aria-label="Shared with">
					{#each shared as p (p.user_id)}
						<li>
							<span>Shared with {who(p)} · read-only</span>
							<form method="POST" action="?/unshare" use:enhance={stay}>
								<input type="hidden" name="trail_id" value={stored.id} />
								<input type="hidden" name="user_id" value={p.user_id} />
								<button type="submit" class="quiet">Remove</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			{#if members.length > 0}
				<form method="POST" action="?/share" class="share-form" use:enhance={stay}>
					<input type="hidden" name="trail_id" value={stored.id} />
					<label for="share-with">Share read-only with</label>
					<select id="share-with" name="user_id" required>
						{#each members as p (p.user_id)}
							<option value={p.user_id}>{who(p)}</option>
						{/each}
					</select>
					<button type="submit">Share</button>
				</form>
			{:else if shared.length === 0}
				<p class="note">No other members in this org to share with.</p>
			{/if}
		{/if}
	</div>
{/if}

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
	.export {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
	}
	.export .muted {
		font-size: 0.9375rem;
	}
	.note {
		margin: 0 0 0.75rem;
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
	}
	.share ul {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-muted);
	}
	.share li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 0.75rem;
	}
	.share-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		margin-bottom: 0.75rem;
		font-size: 0.9375rem;
	}
	.share-form select {
		width: auto;
		max-width: 100%;
		min-height: 2.25rem;
		padding-block: 0.25rem;
	}
	.share-form button {
		min-height: 2.25rem;
		padding-block: 0.25rem;
	}
	.notice {
		margin-bottom: 0.75rem;
	}
</style>
