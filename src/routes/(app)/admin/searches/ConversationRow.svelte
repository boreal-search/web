<!-- A rated conversation (whole trail) none of whose searches is linked: its rating, and, on the
     admin's own trail, the owner, context and first question, linking to the trail itself.
     Anyone else's trail stays private, so only the rating shows. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { stamp } from '#lib/format.js';
	import type { Database } from '#lib/supabase/types.js';
	import RatingMark from './RatingMark.svelte';

	type Row = Pick<
		Database['public']['Views']['search_review']['Row'],
		| 'id'
		| 'created_at'
		| 'user_id'
		| 'user_email'
		| 'org_id'
		| 'org_name'
		| 'query'
		| 'trail_rating'
		| 'trail_note'
	>;
	let { row }: { row: Row } = $props();

	const search = resolve('/(app)/search');
	let readable = $derived(row.user_id !== null);
</script>

<tr class="conversation">
	<td data-label="Time" class="mono"
		><time datetime={row.created_at}>{stamp(row.created_at)}</time>
		<span class="muted">rated</span></td
	>
	<td data-label="User" class="user">
		{#if readable}{row.user_email}{:else}<span class="muted">Not readable</span>{/if}
	</td>
	<td data-label="Context"
		>{readable ? (row.org_id ? (row.org_name ?? 'Deleted org') : 'Public') : ''}</td
	>
	<td data-label="Query" class="query">
		<span class="kind">Conversation</span>
		{#if readable}
			<a href="{search}?trail={row.id}">{row.query}</a>
		{:else}
			<span class="muted">Another user's conversation; its questions stay private.</span>
		{/if}
	</td>
	<td data-label="Data sources"></td>
	<td data-label="Outcome"></td>
	<td data-label="Time taken"></td>
	<td data-label="Rating" class="ratings">
		<RatingMark who="Conversation" rating={row.trail_rating} note={row.trail_note} />
	</td>
</tr>

<style>
	td {
		vertical-align: top;
	}
	.mono,
	.kind {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}
	.mono .muted {
		display: block;
	}
	.kind {
		display: inline-block;
		margin-right: 0.375rem;
		padding: 0 0.375rem;
		border: 1px solid var(--color-edge);
		border-radius: 2px;
		color: var(--color-muted);
	}
	.user {
		overflow-wrap: anywhere;
	}
	.query {
		min-width: 14rem;
	}
	@media (min-width: 48rem) {
		.ratings {
			white-space: nowrap;
		}
	}
</style>
