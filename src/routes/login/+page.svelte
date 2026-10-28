<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	let password = $state('');
</script>

<h1>Log in</h1>

{#if data.linkError && !form}
	<p class="error" role="alert">{data.linkError}</p>
{/if}

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
		<label>
			Password <small>(optional — leave blank to get an email link)</small>
			<input
				type="password"
				name="password"
				autocomplete="current-password"
				bind:value={password}
			/>
		</label>
		<input type="hidden" name="redirectTo" value={data.redirectTo} />
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button type="submit" class="primary" disabled={submitting}>
			{#if password}
				{submitting ? 'Signing in…' : 'Sign in'}
			{:else}
				{submitting ? 'Sending…' : 'Email me a sign-in link'}
			{/if}
		</button>
	</form>
	<p>
		<a href={resolve('/forgot')}>Forgot your password?</a> · No account?
		<a href={resolve('/signup')}>Sign up</a>
	</p>
{/if}
