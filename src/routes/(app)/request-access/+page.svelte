<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AccessRequestSent from '#lib/components/AccessRequestSent.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let open = $derived(data.accessRequest.available ? data.accessRequest.open : null);
	let errors = $derived((form && 'errors' in form ? form.errors : undefined) ?? {});
	let values = $derived(form && 'values' in form ? form.values : null);
	let partial = $derived(form && 'partial' in form ? form.partial : false);
	let saveError = $derived(form && 'error' in form ? form.error : null);
</script>

<svelte:head>
	<title>Request access · Boreal Search</title>
</svelte:head>

<div class="page-head">
	<h1>Request access</h1>
</div>

{#if open}
	<AccessRequestSent request={open} {partial} />
	<p><a href={resolve('/(app)')}>Back to data sources</a></p>
{:else if !data.accessRequest.available}
	<p class="empty">
		Access requests aren't available right now. Email
		<a href="mailto:support@borealsearch.app">support@borealsearch.app</a> with your organization's name
		and the documents you want to search.
	</p>
{:else}
	<p class="muted intro">
		Search your organization's own documents. Tell us who you are and what you want to search, and
		we'll reply{data.email ? ` to ${data.email}` : ''}.
	</p>
	<form method="POST" class="stack" use:enhance>
		<label class="field">
			Organization
			<input
				name="organization"
				required
				maxlength="200"
				autocomplete="organization"
				value={values?.organization ?? ''}
				aria-invalid={errors.organization ? 'true' : undefined}
				aria-describedby={errors.organization ? 'organization-error' : undefined}
			/>
			{#if errors.organization}
				<span class="field-error" id="organization-error">{errors.organization}</span>
			{/if}
		</label>
		<label class="field">
			Your role (optional)
			<input
				name="role"
				maxlength="200"
				autocomplete="organization-title"
				value={values?.role ?? ''}
				aria-invalid={errors.role ? 'true' : undefined}
				aria-describedby="role-help{errors.role ? ' role-error' : ''}"
			/>
			<span class="help" id="role-help"
				>For example, environmental assessment consultant or regulatory reviewer.</span
			>
			{#if errors.role}<span class="field-error" id="role-error">{errors.role}</span>{/if}
		</label>
		<label class="field">
			What do you want to search?
			<textarea
				name="use_case"
				required
				maxlength="2000"
				rows="5"
				value={values?.useCase ?? ''}
				aria-invalid={errors.useCase ? 'true' : undefined}
				aria-describedby="use-case-help{errors.useCase ? ' use-case-error' : ''}"></textarea>
			<span class="help" id="use-case-help">
				Which documents, roughly how many, and what for. Up to 2,000 characters.
			</span>
			{#if errors.useCase}
				<span class="field-error" id="use-case-error">{errors.useCase}</span>
			{/if}
		</label>
		{#if saveError}
			<p class="notice" data-tone="error" role="alert">{saveError}</p>
		{/if}
		<div class="actions">
			<button type="submit" class="primary">Send request</button>
		</div>
	</form>
{/if}

<style>
	.intro {
		max-width: 60ch;
	}
</style>
