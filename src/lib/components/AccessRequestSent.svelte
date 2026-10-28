<!--
	The user's open access request: on the dashboard (no org) and on /request-access.
	`partial`: saved, but the email to support didn't go out (founders still see it on /admin).
-->
<script lang="ts">
	import { day } from '#lib/format.js';
	import type { OpenAccessRequest } from '#lib/server/access-requests.js';

	let { request, partial = false }: { request: OpenAccessRequest; partial?: boolean } = $props();
</script>

<div class="notice" data-tone={partial ? 'partial' : undefined} role="status">
	{#if partial}
		<p>
			Request saved, but the email to the Boreal team wasn't sent. They still see it in their list
			of requests, so there's no need to send it again. We'll email you at {request.email}.
		</p>
	{:else}
		<p>Request sent. We'll email you at {request.email}.</p>
	{/if}
	<p class="readout">
		<span>organization <b>{request.organization}</b></span>
		<span>sent <b><time datetime={request.createdAt}>{day(request.createdAt)}</time></b></span>
	</p>
</div>

<style>
	p {
		margin: 0 0 0.375rem;
	}
	.readout {
		overflow-wrap: anywhere;
	}
</style>
