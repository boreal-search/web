<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	let password = $state('');
</script>

<svelte:head>
	<title>Log in · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>Log in</h1>
</div>

{#if form?.sent}
	<p class="notice" role="status">
		Check <strong>{form.email}</strong> for a sign-in link. You can close this tab.
	</p>
	<p><a href={resolve('/login')} data-sveltekit-reload>Use a different email</a></p>
{:else}
	{#if data.linkError && !form}
		<div class="notice" data-tone="error" role="alert">
			<p>{data.linkError}</p>
			<p>
				Enter your email for a new sign-in link, or
				<a href={resolve('/forgot')}>reset your password</a>.
			</p>
		</div>
	{:else if data.redirectTo !== '/' && !form}
		<p class="notice" role="status">
			Log in to continue to <code>{data.redirectTo}</code>.
		</p>
	{/if}

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
				autocomplete="current-password"
				aria-describedby="password-help"
				bind:value={password}
			/>
			<span class="help" id="password-help"
				>Optional. Leave blank to get a sign-in link by email.</span
			>
		</label>
		<input type="hidden" name="redirectTo" value={data.redirectTo} />
		{#if form?.error}
			<p class="notice" data-tone="error" role="alert">{form.error}</p>
		{/if}
		<div class="actions">
			<button type="submit" class="primary" disabled={submitting}>
				{#if password}
					{submitting ? 'Logging in…' : 'Log in'}
				{:else}
					{submitting ? 'Sending…' : 'Email me a sign-in link'}
				{/if}
			</button>
			<a href={resolve('/forgot')}>Forgot your password?</a>
		</div>
	</form>
	<p class="muted">No account? <a href={resolve('/signup')}>Sign up</a></p>
{/if}
