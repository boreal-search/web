<!--
	Sharing a stored trail, for its owner (in the "⋯" menu's Share modal): the people it's shared
	with read-only (members of its org) and a form to share it with another. Forms post to the
	search page's actions; sharing sends no email.
-->
<script module lang="ts">
	import type { TrailRelation } from '#lib/supabase/types.js';

	export interface StoredTrail {
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
</script>

<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';

	let { trail }: { trail: Omit<StoredTrail, 'isOwner'> } = $props();

	// Stay on this trail: by default a submission lands on the action's URL, without `?trail=`.
	const stay: SubmitFunction =
		() =>
		({ update }) =>
			update({ navigate: false });

	let shared = $derived(trail.people.filter((p) => p.relation === 'shared'));
	let members = $derived(trail.people.filter((p) => p.relation === 'member'));
	const who = (p: { email: string; display_name: string | null }) =>
		p.display_name ? `${p.display_name} (${p.email})` : p.email;
</script>

<div class="share">
	{#if trail.org_id === null}
		<p class="note">Trails searched in Public can't be shared.</p>
	{:else}
		{#if shared.length > 0}
			<ul aria-label="Shared with">
				{#each shared as p (p.user_id)}
					<li>
						<span>Shared with {who(p)} · read-only</span>
						<form method="POST" action="?/unshare" use:enhance={stay}>
							<input type="hidden" name="trail_id" value={trail.id} />
							<input type="hidden" name="user_id" value={p.user_id} />
							<button type="submit" class="quiet">Remove</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		{#if members.length > 0}
			<form method="POST" action="?/share" class="share-form" use:enhance={stay}>
				<input type="hidden" name="trail_id" value={trail.id} />
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

<style>
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
</style>
