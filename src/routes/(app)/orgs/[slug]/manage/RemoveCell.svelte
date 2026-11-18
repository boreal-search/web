<!-- Two-step destructive action without a dialog: "Remove…" reveals the danger button. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';

	let {
		action,
		submit,
		summary,
		children
	}: { action: string; submit: SubmitFunction; summary: Snippet; children: Snippet } = $props();
</script>

<td class="end">
	<details class="confirm">
		<summary>{@render summary()}</summary>
		<form method="POST" {action} use:enhance={submit}>
			{@render children()}
		</form>
	</details>
</td>

<style>
	td.end {
		text-align: right;
		width: 1%;
		white-space: nowrap;
	}

	.confirm summary {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0;
		list-style: none;
		color: var(--color-muted);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
	}
	.confirm summary::-webkit-details-marker {
		display: none;
	}
	.confirm[open] summary {
		color: var(--color-ink);
	}
	.confirm form {
		display: grid;
		justify-items: end;
		gap: 0.5rem;
		width: 16rem;
		max-width: 100%;
		margin-left: auto;
		padding-bottom: 0.5rem;
		white-space: normal;
		text-align: right;
	}
	.confirm :global(.help) {
		margin: 0;
	}

	@media (max-width: 40rem) {
		td.end {
			width: auto;
			text-align: left;
		}
		.confirm form {
			justify-items: start;
			margin-left: 0;
			text-align: left;
		}
	}
</style>
