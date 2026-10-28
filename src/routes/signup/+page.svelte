<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign up · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>Sign up</h1>
</div>

{#if form?.sent}
	<div class="notice" role="status">
		<p>
			Check <strong>{form.email}</strong> for a link to confirm your address. You can close this tab.
		</p>
		<p>Org invites and access for this address apply once it is confirmed.</p>
	</div>
	<p><a href={resolve('/signup')} data-sveltekit-reload>Wrong address? Start again</a></p>
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
		<label class="field">
			Work email
			<input type="email" name="email" autocomplete="email" required value={form?.email ?? ''} />
		</label>
		<label class="field">
			Password
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
			Confirm password
			<input type="password" name="confirm" autocomplete="new-password" minlength="8" required />
		</label>
		{#if form?.error}
			<p class="notice" data-tone="error" role="alert">{form.error}</p>
		{/if}
		<div class="actions">
			<button type="submit" class="primary" disabled={submitting}>
				{submitting ? 'Creating account…' : 'Create account'}
			</button>
		</div>
	</form>
{/if}

<p class="muted">Already have an account? <a href={resolve('/login')}>Log in</a></p>
