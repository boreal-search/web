<!-- An org's users and searches in the platform admin tables, filtered to that org. -->
<script lang="ts">
	import { resolve } from '$app/paths';

	let { orgId, orgName }: { orgId: string; orgName: string } = $props();

	let query = $derived(`?${new URLSearchParams({ org: orgId })}`);
</script>

<span class="links">
	<a href="{resolve('/(site)/admin/users')}{query}"
		>Users<span class="sr-only"> in {orgName}</span></a
	>
	<span aria-hidden="true">·</span>
	<a href="{resolve('/(site)/admin/searches')}{query}"
		>Searches<span class="sr-only"> in {orgName}</span></a
	>
</span>

<style>
	.links {
		display: inline-flex;
		gap: 0.5rem;
		color: var(--color-muted);
		white-space: nowrap;
	}
</style>
