<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let searching = $state(false);

	// Keep the user's last selection across submits; default to everything they can see.
	let selected = $derived(new Set(form?.requested ?? data.dataSources.map((ds) => ds.id)));
	let results = $derived(form && 'response' in form ? form.response : null);
</script>

<h1>Search</h1>

{#if data.engineError}
	<p class="error" role="alert">Could not reach the engine: {data.engineError}</p>
{/if}

<form
	method="POST"
	class="stack"
	use:enhance={() => {
		searching = true;
		return async ({ update }) => {
			await update({ reset: false });
			searching = false;
		};
	}}
>
	<label>
		Query
		<input type="search" name="query" required value={form?.query ?? ''} autocomplete="off" />
	</label>

	<fieldset>
		<legend>Data sources</legend>
		{#if data.dataSources.length === 0}
			<p class="muted">None available.</p>
		{/if}
		{#each data.dataSources as ds (ds.id)}
			<label>
				<input type="checkbox" name="data_source_ids" value={ds.id} checked={selected.has(ds.id)} />
				{ds.name}
				<span class="muted">({ds.page_count} pages)</span>
			</label>
		{/each}
	</fieldset>

	<details>
		<summary>Options</summary>
		<label>
			Results
			<input type="number" name="top_k" min="1" max="50" value="10" />
		</label>
		<label>
			<input type="checkbox" name="rerank" value="on" checked />
			Rerank
		</label>
	</details>

	{#if form?.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	<button type="submit" class="primary" disabled={searching || data.dataSources.length === 0}>
		{searching ? 'Searching…' : 'Search'}
	</button>
</form>

{#if results}
	<section aria-live="polite">
		<h2>
			{results.results.length} result{results.results.length === 1 ? '' : 's'}
			<span class="muted">({results.retrieval_ms} ms{results.reranked ? ', reranked' : ''})</span>
		</h2>
		{#if results.results.length === 0}
			<p class="muted">Nothing matched.</p>
		{:else}
			<ul class="results">
				{#each results.results as r (`${r.document_id}:${r.page_number}`)}
					<li>
						<a href={r.pdf_url} target="_blank" rel="external noopener">
							<img
								src={r.page_image_url}
								alt="Page {r.page_number} of {r.document_title}"
								loading="lazy"
							/>
						</a>
						<div>
							<h3>
								<a href={r.pdf_url} target="_blank" rel="external noopener">{r.document_title}</a>
							</h3>
							<p class="muted">
								Page {r.page_number} · {r.data_source_id} · score {r.score.toFixed(3)}
							</p>
							{#if r.snippet}
								<p>{r.snippet}</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
