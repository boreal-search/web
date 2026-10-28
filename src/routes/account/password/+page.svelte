<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<h1>Set a new password</h1>

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
		New password <small>(at least 8 characters)</small>
		<input type="password" name="password" autocomplete="new-password" minlength="8" required />
	</label>
	<label>
		Confirm new password
		<input type="password" name="confirm" autocomplete="new-password" minlength="8" required />
	</label>
	{#if form?.error}
		<p class="error" role="alert">
			{form.error}
			{#if form.expired}<a href={resolve('/forgot')}>Request a new link</a>.{/if}
		</p>
	{/if}
	<button type="submit" class="primary" disabled={submitting}>
		{submitting ? 'Saving…' : 'Set password'}
	</button>
</form>
