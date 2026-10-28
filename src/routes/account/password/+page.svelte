<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Set a new password · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>Set a new password</h1>
</div>

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
		New password
		<input
			type="password"
			name="password"
			autocomplete="new-password"
			minlength="8"
			required
			aria-describedby="password-help"
		/>
		<span class="help" id="password-help">At least 8 characters.</span>
	</label>
	<label class="field">
		Confirm new password
		<input type="password" name="confirm" autocomplete="new-password" minlength="8" required />
	</label>
	{#if form?.error}
		<p class="notice" data-tone="error" role="alert">
			{form.error}
			{#if form.expired}<a href={resolve('/forgot')}>Request a new link</a>.{/if}
		</p>
	{/if}
	<div class="actions">
		<button type="submit" class="primary" disabled={submitting}>
			{submitting ? 'Saving…' : 'Save password'}
		</button>
	</div>
</form>
