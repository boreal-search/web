<!--
	Stand-in rows while an engine read streams in: a table's shape (a wide first cell, then
	`columns - 1` short ones). Blank for the first 300 ms so fast reads don't flash; then a quiet
	pulse (none with reduced motion). `label` is what screen readers hear. Streamed data arrives
	only with JavaScript, so without it a note says so.
-->
<script lang="ts">
	let {
		label,
		rows = 4,
		columns = 1
	}: { label: string; rows?: number; columns?: number } = $props();
</script>

<noscript><p class="muted">This part loads with JavaScript, which is off.</p></noscript>
<div class="skeleton" role="status" aria-busy="true">
	<span class="sr-only">{label}</span>
	{#each { length: rows }, r (r)}
		<div class="row" aria-hidden="true">
			<span class="bar" style:width="{40 + ((r * 23) % 35)}%"></span>
			{#each { length: columns - 1 }, c (c)}
				<span class="bar short"></span>
			{/each}
		</div>
	{/each}
</div>

<style>
	.skeleton {
		animation: appear 1ms 300ms both;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		min-height: 2.75rem;
		border-bottom: 1px solid var(--color-rule);
	}
	.bar {
		height: 0.75rem;
		background: var(--color-rule);
		animation: pulse 1.6s ease-in-out infinite;
	}
	.short {
		flex: none;
		width: 4rem;
		margin-left: auto;
	}
	.short + .short {
		margin-left: 0;
	}
	@keyframes appear {
		from {
			visibility: hidden;
		}
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
		}
	}
</style>
