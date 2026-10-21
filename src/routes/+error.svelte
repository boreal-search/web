<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<h1>{page.status}</h1>
<p class="error">{page.error?.message ?? 'Something went wrong.'}</p>
<p><a href={resolve('/(app)')}>Back to dashboard</a></p>
