<!-- One rating as a short line ("User: Bad"), with its note on hover; nothing when unrated. -->
<script lang="ts">
	import { RATING_LABELS, type Rating } from '#lib/rating.js';

	let {
		who,
		rating,
		note = null
	}: { who: string; rating: Rating | null; note?: string | null } = $props();
</script>

{#if rating}
	<span class="mark" data-rating={rating} title={note ?? undefined}>
		<span class="muted">{who}:</span>
		<b>{RATING_LABELS[rating]}</b>{#if note}<span class="muted" aria-label="with a note: {note}"
				>*</span
			>{/if}
	</span>
{/if}

<style>
	.mark {
		display: block;
		font-size: 0.875rem;
	}
	.mark b {
		font-weight: 600;
	}
</style>
