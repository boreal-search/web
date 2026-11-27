<!--
	A data source's notice (DataSource.notice), verbatim: its own newlines kept, URLs as links.
	Built from text parts (`noticeParts`), never HTML.
-->
<script lang="ts">
	import { noticeParts } from '#lib/notice.js';

	let { text }: { text: string } = $props();

	let parts = $derived(noticeParts(text));
</script>

<p class="source-notice">
	{#each parts as part, i (i)}{#if part.kind === 'link'}<a
				href={part.text}
				target="_blank"
				rel="external noopener">{part.text}</a
			>{:else}{part.text}{/if}{/each}
</p>

<style>
	.source-notice {
		margin: 0;
		max-width: 68ch;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--color-muted);
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
</style>
