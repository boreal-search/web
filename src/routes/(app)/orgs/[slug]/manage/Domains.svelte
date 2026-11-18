<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import PlatformOnly from '#lib/components/PlatformOnly.svelte';
	import { ROLE_LABELS } from '#lib/roles.js';
	import RemoveCell from './RemoveCell.svelte';
	import type { PageData } from './$types';

	let {
		domains,
		org,
		submit,
		feedback
	}: {
		domains: NonNullable<PageData['platform']>['domains'];
		org: PageData['org'];
		submit: (slot: 'domains', reset?: boolean) => SubmitFunction;
		feedback: Snippet<['domains']>;
	} = $props();
</script>

<section class="band" aria-labelledby="domains-heading">
	<h2 id="domains-heading">Email domains</h2>
	<PlatformOnly note="Org admins don't see this section." />
	<p id="domains-help" class="muted">
		Anyone who confirms an address at one of these domains (a new account or an email change) joins
		{org.name} as <strong>{ROLE_LABELS[org.default_role]}</strong>, the role set in Settings.
		Existing accounts aren't added; add them by email. A domain belongs to one org only, and public
		providers like gmail.com are refused.
	</p>
	{#if domains.length > 0}
		<table class="stacked domains">
			<thead>
				<tr>
					<th scope="col">Domain</th>
					<th scope="col"><span class="sr-only">Remove</span></th>
				</tr>
			</thead>
			<tbody>
				{#each domains as domain (domain)}
					<tr>
						<td data-label="Domain"><span class="email">@{domain}</span></td>
						<RemoveCell action="?/removeDomain" submit={submit('domains')}>
							{#snippet summary()}Remove<span class="sr-only"> @{domain}</span>…{/snippet}
							<input type="hidden" name="domain" value={domain} />
							<p class="help">New sign-ups from @{domain} stop joining. Current members stay.</p>
							<button type="submit" class="danger" aria-label="Remove @{domain}">
								Remove domain
							</button>
						</RemoveCell>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<form method="POST" action="?/addDomain" class="stack" use:enhance={submit('domains')}>
		<label class="field">
			Domain
			<input
				name="domain"
				placeholder="acme.com"
				required
				autocomplete="off"
				aria-describedby="domain-help"
			/>
			<span class="help" id="domain-help">The part after the @, like acme.com.</span>
		</label>
		{@render feedback('domains')}
		<div class="actions">
			<button type="submit" class="primary">Add domain</button>
		</div>
	</form>
</section>

<style>
	.email {
		overflow-wrap: anywhere;
	}
	.domains :global(td) {
		vertical-align: middle;
	}
</style>
