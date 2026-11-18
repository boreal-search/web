<!-- The table's filters, as a GET form: the view stays in the URL. Keeps the current sort. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { humanise } from '#lib/format.js';
	import { RATING_LABELS, RATINGS } from '#lib/rating.js';
	import type { ReviewQuery } from '#lib/server/search-review.js';
	import type { SearchStatus } from '#lib/supabase/types.js';

	let {
		q,
		outcomes,
		orgs,
		filtered,
		sorted
	}: {
		q: ReviewQuery;
		outcomes: readonly SearchStatus[];
		orgs: { id: string; name: string }[];
		filtered: boolean;
		/** Sorted other than newest first: the form carries the sort along. */
		sorted: boolean;
	} = $props();

	const action = resolve('/(site)/admin/searches');
	let orgValue = $derived(q.org?.kind === 'org' ? q.org.id : (q.org?.kind ?? ''));
</script>

<form method="GET" {action} role="search" class="filters">
	<label class="wide">
		<span>Query contains</span>
		<input type="search" name="q" value={q.q} autocomplete="off" spellcheck="false" />
	</label>
	<label>
		<span>User email contains</span>
		<input type="search" name="user" value={q.user} autocomplete="off" spellcheck="false" />
	</label>
	<label>
		<span>Context</span>
		<select name="org" value={orgValue}>
			<option value="">Any</option>
			<option value="public">Public</option>
			{#each orgs as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
		</select>
	</label>
	<label>
		<span>Data source id</span>
		<input
			type="text"
			name="source"
			value={q.source ?? ''}
			class="mono"
			autocomplete="off"
			spellcheck="false"
		/>
	</label>
	<label>
		<span>Outcome</span>
		<select name="status" value={q.status ?? ''}>
			<option value="">Any</option>
			{#each outcomes as o (o)}<option value={o}>{humanise(o)}</option>{/each}
		</select>
	</label>
	<label>
		<span>Rating</span>
		<select name="rating" value={q.rating ?? ''}>
			<option value="">Any</option>
			{#each RATINGS as r (r)}<option value={r}>{RATING_LABELS[r]}</option>{/each}
			<option value="rated">Rated</option>
			<option value="none">Not rated</option>
		</select>
	</label>
	<fieldset>
		<legend>Date (UTC)</legend>
		<label><span class="sr-only">From</span><input type="date" name="from" value={q.from} /></label>
		<span aria-hidden="true">–</span>
		<label><span class="sr-only">To</span><input type="date" name="to" value={q.to} /></label>
	</fieldset>
	<fieldset>
		<legend>Time taken (s)</legend>
		<label
			><span class="sr-only">At least, seconds</span><input
				type="number"
				name="min_s"
				min="0"
				step="0.1"
				inputmode="decimal"
				value={q.minSeconds}
			/></label
		>
		<span aria-hidden="true">–</span>
		<label
			><span class="sr-only">At most, seconds</span><input
				type="number"
				name="max_s"
				min="0"
				step="0.1"
				inputmode="decimal"
				value={q.maxSeconds}
			/></label
		>
	</fieldset>
	{#if sorted}
		<input type="hidden" name="sort" value={q.sort.key} />
		<input type="hidden" name="dir" value={q.sort.dir} />
	{/if}
	<div class="go">
		<button type="submit">Filter</button>
		{#if filtered}<a href={action}>Clear</a>{/if}
	</div>
</form>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem 1rem;
		margin-bottom: 1.5rem;
	}
	.filters label,
	fieldset {
		display: grid;
		gap: 0.25rem;
		font-size: 0.875rem;
		font-weight: 500;
	}
	fieldset {
		grid-template-columns: auto auto auto;
		align-items: center;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		grid-column: 1 / -1;
		padding: 0;
		margin-bottom: 0.25rem;
	}
	.filters input {
		width: 11rem;
		max-width: 100%;
	}
	.wide input {
		width: 16rem;
	}
	input[type='number'] {
		width: 5.5rem;
	}
	input[type='date'] {
		width: auto;
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}
	.go {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
</style>
