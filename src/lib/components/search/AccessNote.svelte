<!--
	What the search screen says about access. Nothing to search: for a user in no org, a big
	"Request access" (or their open request); for an org without grants, who can fix it. With
	public data sources only, a quiet line offering access for their own documents.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import AccessRequestSent from '#lib/components/AccessRequestSent.svelte';
	import type { OpenAccessRequest } from '#lib/server/access-requests.js';

	let {
		searchable,
		noOrg,
		request
	}: { searchable: boolean; noOrg: boolean; request: OpenAccessRequest | null } = $props();

	const href = resolve('/(app)/request-access');
</script>

{#if !searchable && noOrg}
	<div class="no-access">
		<p class="empty">You're not in an org yet, and there are no public data sources to search.</p>
		{#if request}
			<AccessRequestSent {request} />
		{:else}
			<p>
				Request access to search your organization's documents, or ask your org admin for an invite.
			</p>
			<a class="button primary" {href}>Request access</a>
		{/if}
	</div>
{:else if !searchable}
	<p class="empty">
		Your org doesn't have access to any data sources yet. Ask a platform admin to grant it some.
	</p>
{:else if noOrg && request}
	<AccessRequestSent {request} />
{:else if noOrg}
	<p class="muted">
		Want to search your own documents? <a {href}>Request access for your organization</a>.
	</p>
{/if}

<style>
	.no-access {
		display: grid;
		justify-items: start;
		gap: 1rem;
	}
	.no-access p {
		margin: 0;
	}
	.no-access .button {
		min-height: 3rem;
		padding-inline: 1.5rem;
		font-size: 1.0625rem;
	}
</style>
