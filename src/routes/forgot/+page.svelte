<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<h1>Reset your password</h1>

{#if form?.sent}
	<p>
		If an account exists for <strong>{form.email}</strong>, we sent it a link to set a new password.
		The link works once and expires in an hour.
	</p>
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
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button type="submit" class="primary" disabled={submitting}>
			{submitting ? 'Sending…' : 'Email me a reset link'}
		</button>
	</form>
{/if}

<p><a href={resolve('/login')}>Back to log in</a></p>
