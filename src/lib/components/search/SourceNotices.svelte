<!--
	The notices of the data sources an answer cites, or a step's pages come from: each once.
-->
<script lang="ts">
	import SourceNotice from '#lib/components/SourceNotice.svelte';

	let { notices, label }: { notices: readonly string[]; label: string } = $props();
</script>

{#if notices.length > 0}
	<aside class="notices" aria-label={label}>
		{#each notices as text (text)}<SourceNotice {text} />{/each}
	</aside>
{/if}

<style>
	.notices {
		display: grid;
		gap: 0.375rem;
		margin: 0.75rem 0;
	}
</style>
