<script lang="ts">
	// The search screen inside its trail sidebar (SearchShell). The trail shown is the page's
	// `?trail=` (also set, shallowly, once a new trail is stored).
	import { page } from '$app/state';
	import SearchShell from '#lib/components/search/SearchShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<SearchShell
	trails={data.trails}
	currentId={page.url.searchParams.get('trail')}
	collapsed={data.sidebarCollapsed}
>
	{@render children()}
</SearchShell>
