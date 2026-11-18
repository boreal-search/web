<script lang="ts">
	import '@fontsource-variable/schibsted-grotesk';
	import '@fontsource-variable/source-serif-4';
	import '@fontsource-variable/jetbrains-mono';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import faviconPng from '#lib/assets/favicon.png';
	import appleTouchIcon from '#lib/assets/apple-touch-icon.png';
	import type { LayoutProps } from './$types';

	// The chrome is the group's: the app shell for (app), SiteFrame for (site) and errors.
	let { data, children }: LayoutProps = $props();

	// SSR sets <html data-theme>; keep it in step when the theme changes without a reload.
	$effect(() => {
		document.documentElement.dataset.theme = data.theme;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="icon" href={faviconPng} type="image/png" sizes="48x48" />
	<link rel="apple-touch-icon" href={appleTouchIcon} />
	<title>Boreal Search</title>
</svelte:head>

<a class="skip" href="#main">Skip to content</a>

{@render children()}

<style>
	.skip {
		position: absolute;
		left: 1rem;
		top: -4rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-surface);
		z-index: 10;
	}
	.skip:focus {
		top: 0.5rem;
	}
</style>
