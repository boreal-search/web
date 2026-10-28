<script lang="ts">
	import { enhance } from '$app/forms';
	import { resultAnchorId, splitCitations, verificationBadge } from '#lib/answer.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let searching = $state(false);

	// Keep the user's last selection across submits; default to everything they can see.
	let selected = $derived(new Set(form?.requested ?? data.dataSources.map((ds) => ds.id)));
	let outcome = $derived(form && 'outcome' in form ? form.outcome : null);
	let results = $derived(outcome?.response ?? null);
	let answerNotice = $derived(form && 'answerNotice' in form ? form.answerNotice : null);
	let answerOn = $derived(form?.answer ?? true);
	let answer = $derived(
		outcome && (outcome.answer.kind === 'ok' || outcome.answer.kind === 'abstained')
			? outcome.answer.answer
			: null
	);
	let segments = $derived(answer ? splitCitations(answer.text, results?.results.length ?? 0) : []);
	let badge = $derived(answer ? verificationBadge(answer.verification) : null);
	// If the engine listing failed, still show the user's last selection so a retry keeps it.
	let pickable = $derived(
		data.dataSources.length > 0
			? data.dataSources.map((ds) => ({ id: ds.id, name: ds.name, pages: ds.page_count }))
			: (form?.requested ?? []).map((id) => ({ id, name: id, pages: null }))
	);
	let sourceNames = $derived(new Map(data.dataSources.map((ds) => [ds.id, ds.name])));
</script>

<h1>Search</h1>

{#if !data.inOrg}
	<p>You're not in an org yet. Ask your org admin for an invite.</p>
{:else if data.accessibleDataSourceIds.length === 0}
	<p>
		Your org doesn't have access to any data sources yet. Ask a platform admin to grant it some.
	</p>
{:else}
	{#if data.engineError}
		<p class="error" role="alert">{data.engineError}</p>
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
			{#each pickable as ds (ds.id)}
				<label>
					<input
						type="checkbox"
						name="data_source_ids"
						value={ds.id}
						checked={selected.has(ds.id)}
					/>
					{ds.name}
					{#if ds.pages !== null}<span class="muted">({ds.pages} pages)</span>{/if}
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

		<label>
			<input type="checkbox" name="answer" value="on" checked={answerOn} />
			Draft an answer from the top results
		</label>

		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}

		<button type="submit" class="primary" disabled={searching || pickable.length === 0}>
			{searching ? 'Searching…' : 'Search'}
		</button>
		{#if searching && answerOn}
			<p class="muted" role="status">
				Searching and drafting an answer; this can take a few seconds.
			</p>
		{/if}
	</form>
{/if}

{#if answer && badge}
	<section aria-labelledby="answer-heading">
		<h2 id="answer-heading">Answer</h2>
		<p class={['verification', badge.state]}>
			<strong>{badge.label}</strong>
			{#if answer.abstained}
				<span class="muted">· the sources don't cover this question</span>
			{/if}
		</p>
		<p class="answer">
			{#each segments as seg, i (i)}
				{#if seg.kind === 'cite'}
					<a href="#{resultAnchorId(seg.ref)}" aria-label="Source {seg.ref}">[{seg.ref}]</a>
				{:else}
					{seg.text}
				{/if}
			{/each}
		</p>
		{#if badge.unsupported.length > 0}
			<details>
				<summary>
					{badge.unsupported.length} unsupported claim{badge.unsupported.length === 1 ? '' : 's'}
				</summary>
				<ul>
					{#each badge.unsupported as c, i (i)}
						<li>
							{c.claim}
							{#if c.ref !== null}<span class="muted">(cited [{c.ref}])</span>{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
		<p class="muted">
			<small>
				{answer.model} · drafted in {answer.generation_ms} ms · verified in {answer.verify_ms} ms
			</small>
		</p>
	</section>
{:else if answerNotice}
	<p class="muted" role="status">{answerNotice}</p>
{/if}

{#if results}
	<section aria-live="polite">
		<h2>
			{results.results.length} result{results.results.length === 1 ? '' : 's'}
			<span class="muted">({results.retrieval_ms} ms{results.reranked ? ', reranked' : ''})</span>
		</h2>
		{#if results.results.length === 0}
			<p>No pages matched. Try broader or different wording, or tick more data sources above.</p>
		{:else}
			<ul class="results">
				{#each results.results as r, i (`${r.document_id}:${r.page_number}`)}
					<li id={resultAnchorId(i + 1)}>
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
								#{i + 1} · Page {r.page_number} · {sourceNames.get(r.data_source_id) ??
									r.data_source_id}
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

<style>
	.verification.partial {
		color: var(--warn, #a15c00);
	}
	.answer {
		white-space: pre-line;
	}
	li:target {
		outline: 2px solid currentColor;
	}
</style>
