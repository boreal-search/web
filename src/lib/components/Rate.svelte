<!--
	Good / Bad on a search or a whole trail, with an optional short note. Saves through
	POST /search/rating as the user; shown only to those who may rate (`canRate`). Choosing the pressed one
	again clears it; choosing the other replaces it. Not an answer state: those stay AnswerCheck's.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		NOTE_MAX,
		RATING_LABELS,
		RATINGS,
		type Rating,
		type RatingTarget,
		type RatingValue
	} from '#lib/rating.js';

	let {
		target,
		initial,
		label
	}: {
		target: RatingTarget;
		initial: RatingValue | null;
		/** What is rated, read aloud and shown before the buttons ("This response"). */
		label: string;
	} = $props();

	let value = $derived(initial);
	let saving = $state(false);
	let problem = $state<string | null>(null);
	let noting = $state(false);
	let draft = $state('');

	async function save(next: RatingValue | null) {
		saving = true;
		problem = null;
		try {
			const res = await fetch(resolve('/(app)/search/rating'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ target, rating: next?.rating ?? null, note: next?.note ?? null })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				problem = body?.error ?? `Not saved (${res.status}).`;
				return false;
			}
			value = next;
			return true;
		} catch {
			problem = 'Not saved: the connection was lost.';
			return false;
		} finally {
			saving = false;
		}
	}

	const choose = (r: Rating) =>
		save(value?.rating === r ? null : { rating: r, note: value?.note ?? null });

	function openNote() {
		draft = value?.note ?? '';
		noting = true;
	}

	async function saveNote(e: SubmitEvent) {
		e.preventDefault();
		if (!value) return;
		const note = draft.trim() || null;
		if (await save({ rating: value.rating, note })) noting = false;
	}
</script>

<div class="rate">
	<div class="row" role="group" aria-label="Rate: {label}">
		<span class="label">{label}</span>
		{#each RATINGS as r (r)}
			<button
				type="button"
				aria-pressed={value?.rating === r}
				disabled={saving}
				onclick={() => choose(r)}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true" class={r}>
					<path
						d="M2 7h2.5v7H2zM5.5 13.5V7l3-5c1.2 0 1.8.8 1.5 2L9.5 6H13c.9 0 1.5.8 1.3 1.7l-1.1 5c-.2.5-.6.8-1.1.8z"
					/>
				</svg>
				{RATING_LABELS[r]}
			</button>
		{/each}
		{#if value && !noting}
			<button type="button" class="quiet" onclick={openNote}>
				{value.note ? 'Edit note' : 'Add a note'}
			</button>
		{/if}
	</div>
	{#if noting}
		<form class="note" onsubmit={saveNote}>
			<label class="sr-only" for="note-{target.id}">Note on {label}</label>
			<input
				id="note-{target.id}"
				bind:value={draft}
				maxlength={NOTE_MAX}
				placeholder="What was right or wrong?"
				autocomplete="off"
			/>
			<button type="submit" disabled={saving}>Save note</button>
			<button type="button" class="quiet" onclick={() => (noting = false)}>Cancel</button>
		</form>
	{:else if value?.note}
		<p class="muted said">{value.note}</p>
	{/if}
	{#if problem}<p class="problem" role="status">{problem}</p>{/if}
</div>

<style>
	.rate {
		display: grid;
		gap: 0.375rem;
		margin-top: 0.75rem;
	}
	.row,
	.note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.row button:not(.quiet) {
		min-height: 2rem;
		padding: 0 0.625rem;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.row button[aria-pressed='true'] {
		border-color: var(--color-ink);
		color: var(--color-ink);
		font-weight: 600;
	}
	svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.2;
		stroke-linejoin: round;
	}
	svg.bad {
		transform: rotate(180deg);
	}
	[aria-pressed='true'] svg {
		fill: currentColor;
	}
	.note input {
		flex: 1 1 16rem;
		min-width: 0;
	}
	.said,
	.problem {
		margin: 0;
		font-size: 0.875rem;
	}
	.problem {
		color: var(--color-ink);
	}
</style>
