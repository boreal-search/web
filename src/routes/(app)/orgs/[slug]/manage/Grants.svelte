<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import PlatformOnly from '#lib/components/PlatformOnly.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import { Resolved } from '#lib/resolved.svelte.js';
	import type { PageData } from './$types';

	let {
		platform,
		submit,
		feedback
	}: {
		platform: NonNullable<PageData['platform']>;
		submit: (slot: 'grants', reset?: boolean) => SubmitFunction;
		feedback: Snippet<['grants']>;
	} = $props();

	let granted = $derived(new Set(platform.grantedIds));
	// Not `{#await}`: every action re-runs the load, and a new promise would swap the form for a
	// skeleton (losing focus) until it resolves. The last list stays up instead.
	const list = new Resolved(() => platform.dataSources);
</script>

<section class="band" aria-labelledby="grants-heading">
	<h2 id="grants-heading">Data source access</h2>
	<PlatformOnly note="Org admins don't see this section." />
	{#if !list.current}
		<Skeleton label="Loading data sources" rows={3} />
	{:else}
		{@const result = list.current}
		{#if !result.ok}
			<FailureNotice
				failure={result.failure}
				effect="The data source list can't be loaded, so access can't be changed."
			/>
			<p class="readout">
				<span>granted <b>{platform.grantedIds.join(', ') || 'none'}</b></span>
			</p>
		{:else if result.data.length === 0}
			<p class="empty">The search engine has no data sources.</p>
		{:else}
			<form method="POST" action="?/saveGrants" class="stack" use:enhance={submit('grants', false)}>
				<fieldset aria-describedby="grants-help">
					<legend>Data sources this org can search</legend>
					{#each result.data as ds (ds.id)}
						<label class="check">
							<input
								type="checkbox"
								name="data_source_id"
								value={ds.id}
								checked={granted.has(ds.id)}
							/>
							{ds.name}
						</label>
					{/each}
					<span class="help" id="grants-help">
						Every member can search every document in a checked data source. Unchecking removes that
						access on their next request.
					</span>
				</fieldset>
				{@render feedback('grants')}
				<div class="actions">
					<button type="submit" class="primary">Save access</button>
				</div>
			</form>
		{/if}
	{/if}
</section>
