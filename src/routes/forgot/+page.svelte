<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Reset your password · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>Reset your password</h1>
</div>

{#if form?.sent}
	<p class="notice" role="status">
		If an account exists for <strong>{form.email}</strong>, a link to set a new password is on its
		way. The link works once and expires in an hour.
	</p>
{:else}
	<p>Enter the email you log in with. A link to set a new password will be sent there.</p>
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
		<label class="field">
			Work email
			<input type="email" name="email" autocomplete="email" required value={form?.email ?? ''} />
		</label>
		{#if form?.error}
			<p class="notice" data-tone="error" role="alert">{form.error}</p>
		{/if}
		<div class="actions">
			<button type="submit" class="primary" disabled={submitting}>
				{submitting ? 'Sending…' : 'Email me a reset link'}
			</button>
		</div>
	</form>
{/if}

<p class="muted"><a href={resolve('/login')}>Back to log in</a></p>
