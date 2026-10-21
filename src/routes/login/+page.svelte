<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<h1>Log in</h1>

{#if form?.sent}
	<p>Check <strong>{form.email}</strong> for a sign-in link. You can close this tab.</p>
{:else}
	<form
		method="POST"
		class="stack"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<label>
			Work email
			<input type="email" name="email" autocomplete="email" required value={form?.email ?? ''} />
		</label>
		<input type="hidden" name="redirectTo" value={data.redirectTo} />
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button type="submit" class="primary" disabled={submitting}>
			{submitting ? 'Sending…' : 'Email me a sign-in link'}
		</button>
	</form>
{/if}
