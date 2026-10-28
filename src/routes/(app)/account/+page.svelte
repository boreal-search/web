<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ROLE_LABELS } from '#lib/roles.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	let orgs = $derived([...data.access.memberships].sort((a, b) => a.name.localeCompare(b.name)));
</script>

<svelte:head>
	<title>Account · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>Account</h1>
	<p class="readout">
		<span>email <b>{data.email}</b></span>
		{#if data.nav?.isPlatformAdmin}<span>role <b>Platform admin</b></span>{/if}
	</p>
</div>

<section class="band" aria-labelledby="orgs-heading">
	<h2 id="orgs-heading">Orgs</h2>
	{#if orgs.length === 0}
		<p class="empty">
			You're not in an org, so you can search public data sources only. An org admin can add you by
			email.
		</p>
	{:else}
		<table class="stacked">
			<thead>
				<tr>
					<th scope="col">Org</th>
					<th scope="col">Your role</th>
					<th scope="col"><span class="sr-only">Manage</span></th>
				</tr>
			</thead>
			<tbody>
				{#each orgs as org (org.id)}
					<tr>
						<td data-label="Org">{org.name}</td>
						<td data-label="Your role">{ROLE_LABELS[org.role]}</td>
						<td class="end">
							{#if org.role === 'admin' || data.nav?.isPlatformAdmin}
								<a href={resolve('/(app)/orgs/[slug]/manage', { slug: org.slug })}
									>Manage<span class="sr-only"> {org.name}</span></a
								>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section class="band" aria-labelledby="password-heading">
	<h2 id="password-heading">Change password</h2>

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
		<label class="field">
			Current password
			<input type="password" name="current" autocomplete="current-password" required />
		</label>
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
			<p class="notice" data-tone="error" role="alert">{form.error}</p>
		{:else if form?.updated || (data.updated && !form)}
			<p class="notice" role="status">Password changed.</p>
		{/if}
		<div class="actions">
			<button type="submit" class="primary" disabled={submitting}>
				{submitting ? 'Saving…' : 'Change password'}
			</button>
		</div>
	</form>

	<p class="muted">
		Signed in with an email link and never set a password?
		<a href={resolve('/forgot')}>Get a link to set one</a>.
	</p>
</section>

<style>
	td.end {
		text-align: right;
		width: 1%;
		white-space: nowrap;
	}
	@media (max-width: 40rem) {
		td.end {
			width: auto;
			text-align: left;
		}
	}
</style>
