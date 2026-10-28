<script lang="ts">
	import { enhance } from '$app/forms';
	import { answerCheck, answerCheckLabel, resultAnchorId, splitCitations } from '#lib/answer.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let searching = $state(false);

	let all = $derived(data.groups.flatMap((g) => g.dataSources));
	let noOrg = $derived(data.access.memberships.length === 0);
	// Keep the user's last selection across submits; default to everything they can see.
	let selected = $derived(new Set(form?.requested ?? all.map((ds) => ds.id)));
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
	let check = $derived(answer ? answerCheck(answer) : null);
	let unsupported = $derived(
		check?.state === 'checked' ? check.claims.filter((c) => c.state === 'unsupported') : []
	);
	let groups = $derived(data.groups.filter((g) => g.dataSources.length > 0));
	let sourceNames = $derived(new Map(all.map((ds) => [ds.id, ds.name])));
</script>

<h1>Search</h1>

{#if data.access.dataSourceIds.length === 0}
	{#if noOrg}
		<p>
			You're not in an org yet, and there are no public data sources. Ask your org admin for an
			invite, or contact us to search your own documents.
		</p>
	{:else}
		<p>
			Your org doesn't have access to any data sources yet. Ask a platform admin to grant it some.
		</p>
	{/if}
{:else}
	{#if noOrg}
		<p class="muted">Want your own documents? Contact us.</p>
	{/if}
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

		{#each groups as group (group.label)}
			<fieldset>
				<legend>{group.label}</legend>
				{#each group.dataSources as ds (ds.id)}
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
		{/each}

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

		<button type="submit" class="primary" disabled={searching || groups.length === 0}>
			{searching ? 'Searching…' : 'Search'}
		</button>
		{#if searching && answerOn}
			<p class="muted" role="status">
				Searching and drafting an answer; this can take a few seconds.
			</p>
		{/if}
	</form>
{/if}

{#if answer && check}
	<section aria-labelledby="answer-heading">
		<h2 id="answer-heading">Generated summary</h2>
		<p>
			<span
				class="flag"
				data-state={check.state === 'checked'
					? unsupported.length > 0
						? 'unsupported'
						: 'verified'
					: check.state}>{answerCheckLabel(check)}</span
			>
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
		{#if unsupported.length > 0}
			<details>
				<summary>
					{unsupported.length} unsupported claim{unsupported.length === 1 ? '' : 's'}
				</summary>
				<ul>
					{#each unsupported as c, i (i)}
						<li>
							<span class="flag" data-state="unsupported">Unsupported</span>
							{c.text}
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
	.answer {
		white-space: pre-line;
	}
	li:target {
		outline: 2px solid currentColor;
	}
</style>
