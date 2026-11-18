<script lang="ts">
	import SiteFrame from '#lib/components/SiteFrame.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<SiteFrame user={data.user} nav={data.nav} theme={data.theme}>
	{@render children()}
</SiteFrame>
