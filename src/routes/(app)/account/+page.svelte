<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<h1>Account</h1>

<dl>
	<dt>Email</dt>
	<dd>{data.email}</dd>
</dl>

<h2>Change password</h2>

{#if form?.updated || (data.updated && !form)}
	<p role="status">Your password was updated.</p>
{/if}

<form
	method="POST"
	action="?/password"
	class="stack"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}
>
	<input type="hidden" name="email" autocomplete="username" value={data.email} />
	<label>
		Current password
		<input type="password" name="current" autocomplete="current-password" required />
	</label>
	<label>
		New password <small>(at least 8 characters)</small>
		<input type="password" name="password" autocomplete="new-password" minlength="8" required />
	</label>
	<label>
		Confirm new password
		<input type="password" name="confirm" autocomplete="new-password" minlength="8" required />
	</label>
	{#if form?.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}
	<button type="submit" class="primary" disabled={submitting}>
		{submitting ? 'Saving…' : 'Change password'}
	</button>
</form>

<p>
	Signed in with an email link and never set a password?
	<a href={resolve('/forgot')}>Email me a link to set one</a>.
</p>
