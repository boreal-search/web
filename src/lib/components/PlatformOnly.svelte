<!-- Marks a section only platform admins see; `note` says who doesn't. -->
<script lang="ts">
	let { note }: { note: string } = $props();
</script>

<p class="scope"><span>Platform admin only</span> {note}</p>

<style>
	.scope {
		margin: -0.5rem 0 1rem;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	span {
		margin-right: 0.5rem;
		font: 500 0.75rem/1.4 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink);
	}
</style>
