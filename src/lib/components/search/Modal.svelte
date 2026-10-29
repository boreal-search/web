<!--
	The search screen's one modal (native <dialog>, so focus is trapped and Escape closes): a title,
	a Close button, the content. `full` makes it a full-screen sheet (phones: trails, pages) whose
	header stays put while the content scrolls; sticky content sits under it via `--sticky-top`.
	Each opening starts at the top. Bind `open`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		full = false,
		closeLabel = 'Close',
		onclose,
		children
	}: {
		open?: boolean;
		title: string;
		/** A full-screen sheet instead of a centred box. */
		full?: boolean;
		closeLabel?: string;
		/** After it closes (Escape, Close, backdrop): e.g. give focus back to what opened it. */
		onclose?: () => void;
		children: Snippet;
	} = $props();

	const id = $props.id();
	let dialog = $state<HTMLDialogElement>();

	// The dialog element is outside Svelte's state: keep it in step with `open`.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.scrollTop = 0;
			dialog.showModal();
		} else if (!open && dialog.open) dialog.close();
	});

	function closed() {
		open = false;
		onclose?.();
	}
</script>

<dialog
	bind:this={dialog}
	class={{ full }}
	aria-labelledby="{id}-title"
	onclose={closed}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
>
	<div class="body">
		<header>
			<h2 id="{id}-title">{title}</h2>
			<button type="button" class="quiet" onclick={() => (open = false)}>{closeLabel}</button>
		</header>
		{@render children()}
	</div>
</dialog>

<style>
	dialog {
		width: min(32rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 4rem);
		padding: 0;
		border: 1px solid var(--color-edge);
		background: var(--color-surface);
		color: var(--color-ink);
		overscroll-behavior: contain;
	}
	dialog::backdrop {
		background: color-mix(in srgb, var(--color-ink) 35%, transparent);
	}
	dialog.full {
		width: 100vw;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		border: 0;
		background: var(--color-page);
		--sticky-top: 3.5rem;
	}
	.body {
		padding: 1rem max(1rem, env(safe-area-inset-right)) 1.5rem max(1rem, env(safe-area-inset-left));
	}
	.full .body {
		padding-top: 0;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-rule);
	}
	.full header {
		position: sticky;
		top: 0;
		z-index: 3;
		box-sizing: border-box;
		height: var(--sticky-top);
		padding-bottom: 0;
		background: var(--color-page);
	}
	h2 {
		margin: 0;
		font-size: 1.125rem;
	}
	header button {
		min-height: 2.75rem;
	}
</style>
