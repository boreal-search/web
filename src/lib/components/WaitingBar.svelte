<!--
	The waiting bar for a live step (docs/ui.md "Waiting"): nothing for 300 ms, then segments in
	Basalt and a seconds counter, the stage label only once the engine reports one.
-->
<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { seconds } from '#lib/search-view.js';
	import { stageLabel, WAIT_DELAY_MS, waitSegments, type WaitClock } from '#lib/step-view.js';

	let { clock, now }: { clock: WaitClock; now: number } = $props();

	const reduced = new MediaQuery('prefers-reduced-motion: reduce', false);
	let elapsed = $derived(now - clock.started);
	let segments = $derived(waitSegments(clock, now, reduced.current));
	let label = $derived(stageLabel(clock));
</script>

{#if elapsed >= WAIT_DELAY_MS}
	<div class="waiting">
		<span class="progress" aria-hidden="true">
			{#each segments as s, i (i)}
				<span style:--weight={s.weight} style:--value={s.value}></span>
			{/each}
		</span>
		<span class="readout">
			<!-- Announce stages, not every tick of the counter. -->
			<span role="status" class:sr-only={!label}
				>{label ?? (clock.results_at === null ? 'Searching' : 'Summary in progress')}</span
			>
			<span aria-hidden="true"><b>{seconds(elapsed)}</b> s</span>
		</span>
	</div>
{/if}
