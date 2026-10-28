<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const COPY: Record<number, { title: string; body: string }> = {
		400: { title: "That request didn't work", body: 'Go back and try again.' },
		403: {
			title: "You don't have access to this page",
			body: 'Ask an admin if you need it.'
		},
		404: {
			title: 'Page not found',
			body: 'The address may be mistyped, or the page was moved or removed.'
		},
		502: {
			title: "The search service didn't respond",
			body: 'Try again in a moment.'
		},
		503: {
			title: 'Search is temporarily unavailable',
			body: 'Try again in a moment.'
		}
	};
	const FALLBACK = { title: 'Something went wrong', body: 'Try again in a moment.' };

	let copy = $derived(COPY[page.status] ?? FALLBACK);
	// The server's message is specific ("Data source not found"); show it when it adds detail.
	let detail = $derived.by(() => {
		const message = page.error?.message;
		// 500s carry internal messages; don't show them.
		if (!message || page.status === 500 || message === 'Not Found' || message === 'Internal Error')
			return null;
		return message === copy.title ? null : message;
	});
</script>

<svelte:head>
	<title>{copy.title} · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>{copy.title}</h1>
	<p class="readout"><span>Error <b>{page.status}</b></span></p>
</div>

{#if detail}
	<p class="notice" role="status">{detail}</p>
{/if}
<p>{copy.body}</p>
<p><a href={resolve('/(app)')}>Go to data sources</a></p>
