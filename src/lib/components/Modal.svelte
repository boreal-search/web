<!--
	A modal (native <dialog>, so focus is trapped and Escape closes): a title, a Close button, the
	content. `drawer` makes it a full-height panel from the left (phones: the app sidebar); its
	content sets its own scrolling.
	Each opening starts at the top. Bind `open`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		drawer = false,
		onclose,
		children
	}: {
		open?: boolean;
		title: string;
		/** A full-height panel from the left instead of a centred box. */
		drawer?: boolean;
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
	class={{ drawer }}
	aria-labelledby="{id}-title"
	onclose={closed}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
>
	<div class="body">
		<header>
			<h2 id="{id}-title">{title}</h2>
			<button type="button" class="quiet" onclick={() => (open = false)}>Close</button>
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
	dialog.drawer {
		width: min(20rem, calc(100vw - 3rem));
		height: 100dvh;
		max-height: none;
		margin: 0;
		border: 0;
		border-right: 1px solid var(--color-rule);
		background: var(--color-sidebar);
	}
	@media (prefers-reduced-motion: no-preference) {
		dialog.drawer[open] {
			animation: slide-in 0.2s ease-out;
		}
	}
	@keyframes slide-in {
		from {
			translate: -100% 0;
		}
	}
	.body {
		padding: 1rem max(1rem, env(safe-area-inset-right)) 1.5rem max(1rem, env(safe-area-inset-left));
	}
	.drawer .body {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		height: 100%;
		padding-top: 0;
		padding-bottom: max(1rem, env(safe-area-inset-bottom));
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
	.drawer header {
		flex: none;
		box-sizing: border-box;
		height: 3.5rem;
		padding-bottom: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.125rem;
	}
	header button {
		min-height: 2.75rem;
	}
</style>
