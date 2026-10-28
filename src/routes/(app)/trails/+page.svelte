<script lang="ts">
	// The user's trails and those shared with them; each reopens on the search page.
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { stamp } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const trailHref = (id: string) => `${resolve('/(app)/search')}?trail=${id}`;
</script>

<svelte:head><title>Trails · Boreal Search</title></svelte:head>

<div class="page-head">
	<h1>Trails</h1>
	<p class="readout">
		<span><b>{data.trails.length}</b> {data.trails.length === 1 ? 'trail' : 'trails'}</span>
		<span>yours and shared with you</span>
	</p>
</div>

{#if form?.error}
	<p class="notice" role="status">{form.error}</p>
{:else if form?.notice}
	<p class="notice" role="status">{form.notice}</p>
{/if}

{#if data.trails.length === 0}
	<p class="empty">
		No trails yet. Each search starts one, and refining it adds a step. Orgs that don't keep search
		history keep no trails.
	</p>
{:else}
	<table class="stacked">
		<thead>
			<tr>
				<th scope="col">Title</th>
				<th scope="col">Searched in</th>
				<th scope="col" class="num">Steps</th>
				<th scope="col">Updated</th>
				<th scope="col">Owner</th>
				<th scope="col"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.trails as t (t.id)}
				<tr>
					<td data-label="Title">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?trail= -->
						<a href={trailHref(t.id)}>{t.title}</a>
					</td>
					<td data-label="Searched in">{t.org_name ?? 'Public'}</td>
					<td data-label="Steps" class="num">{t.steps}</td>
					<td data-label="Updated" class="mono">{stamp(t.updated_at)}</td>
					<td data-label="Owner" class="mono">{t.owned ? 'yours' : 'shared with you'}</td>
					<td class="row-actions">
						{#if t.owned}
							<form
								method="POST"
								action="?/delete"
								use:enhance={({ cancel }) => {
									if (!confirm(`Delete the trail "${t.title}"? This can't be undone.`)) cancel();
								}}
							>
								<input type="hidden" name="trail_id" value={t.id} />
								<button type="submit" class="danger" aria-label="Delete trail {t.title}">
									Delete
								</button>
							</form>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	td a {
		overflow-wrap: anywhere;
	}
	.mono {
		font: 400 0.8125rem/1.6 var(--font-mono);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.row-actions {
		text-align: right;
	}
	.row-actions button {
		min-height: 2.25rem;
		padding-block: 0.25rem;
		font-size: 0.875rem;
	}
</style>
