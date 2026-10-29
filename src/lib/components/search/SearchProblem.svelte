<!-- Why the last search from this form produced no step: an engine failure, or a plain line. -->
<script lang="ts">
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import type { SearchProblem } from './live-trail.svelte.js';

	let { problem }: { problem: SearchProblem | null } = $props();
</script>

{#if problem?.failure}
	<FailureNotice failure={problem.failure} />
{:else if problem?.text}
	<p class="notice" role="status">{problem.text}</p>
{/if}

<style>
	.notice {
		margin: 0;
	}
</style>
