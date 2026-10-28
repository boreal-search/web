<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<h1>Sign up</h1>

{#if form?.sent}
	<p>
		Check <strong>{form.email}</strong> for a link to confirm your email. You can close this tab.
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
		<label>
			Password <small>(at least 8 characters)</small>
			<input type="password" name="password" autocomplete="new-password" minlength="8" required />
		</label>
		<label>
			Confirm password
			<input type="password" name="confirm" autocomplete="new-password" minlength="8" required />
		</label>
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button type="submit" class="primary" disabled={submitting}>
			{submitting ? 'Signing up…' : 'Sign up'}
		</button>
	</form>
{/if}

<p>Already have an account? <a href={resolve('/login')}>Log in</a></p>
