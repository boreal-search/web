<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import OrgAdminLinks from '#lib/components/OrgAdminLinks.svelte';
	import { plural } from '#lib/format.js';
	import { ROLE_LABELS } from '#lib/roles.js';
	import AddMember from './AddMember.svelte';
	import Domains from './Domains.svelte';
	import Grants from './Grants.svelte';
	import Invites from './Invites.svelte';
	import Members from './Members.svelte';
	import Settings from './Settings.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Where an action's notice or error is shown: next to the form that sent it. */
	type Slot = 'members' | 'add' | 'invites' | 'review' | 'grants' | 'domains' | 'settings';
	// Set on submit when JS runs. Without JS it stays null and feedback shows in the top slot.
	let from = $state<Slot | null>(null);

	/** `reset: false` for forms that show current state: the reloaded data drives them. */
	function submit(slot: Slot, reset = true): SubmitFunction {
		return () =>
			({ update }) => {
				from = slot;
				return update({ reset });
			};
	}

	let selfId = $derived(data.user?.id);
	let ownRole = $derived(data.members.find((m) => m.userId === selfId)?.role);
</script>

<svelte:head>
	<title>Manage {data.org.name} · Boreal Search</title>
</svelte:head>

{#snippet feedback(slot: Slot | null)}
	{#if form && from === slot}
		{#if form.failure}
			<FailureNotice failure={form.failure} effect={form.effect} />
		{:else if form.error}
			<p class="notice" data-tone="error" role="alert">{form.error}</p>
		{:else if form.notice}
			<p class="notice" data-tone={form.partial ? 'partial' : undefined} role="status">
				{form.notice}
			</p>
		{/if}
	{/if}
{/snippet}

<div class="page-head">
	<h1>{data.org.name}</h1>
	<p class="readout">
		<span><b>{data.members.length}</b> {plural(data.members.length, 'member', 'members')}</span>
		<span
			><b>{data.invites.length}</b>
			{plural(data.invites.length, 'pending invite', 'pending invites')}</span
		>
		<span>slug <b>{data.org.slug}</b></span>
		<span
			>your role <b
				>{[data.platform ? 'Platform admin' : null, ownRole ? ROLE_LABELS[ownRole] : null]
					.filter(Boolean)
					.join(' · ')}</b
			></span
		>
	</p>
	{#if data.platform}<p><OrgAdminLinks orgId={data.org.id} orgName={data.org.name} /></p>{/if}
</div>

{@render feedback(null)}

<Members members={data.members} {selfId} orgName={data.org.name} {submit} {feedback} />
<AddMember {submit} {feedback} />
<Invites invites={data.invites} orgName={data.org.name} {submit} {feedback} />

<section class="band" aria-labelledby="review-heading">
	<h2 id="review-heading">Quality review</h2>
	<form method="POST" action="?/saveReview" class="stack" use:enhance={submit('review', false)}>
		<div class="field">
			<label class="check">
				<input
					type="checkbox"
					name="log_queries"
					checked={data.org.log_queries}
					aria-describedby="log-queries-help"
				/>
				Let Boreal review searches to improve answers
			</label>
			<span class="help" id="log-queries-help">
				When on, Boreal keeps each search's query and the answer it showed (the summary and the
				pages it cited), and Boreal staff read them to check answer quality. When off, only the
				query's length, the data sources, result count, timings and outcome are kept. Applies to new
				searches. Members' own trails are a separate setting.
			</span>
		</div>
		{@render feedback('review')}
		<div class="actions"><button type="submit" class="primary">Save</button></div>
	</form>
</section>

{#if data.platform}
	<Grants platform={data.platform} {submit} {feedback} />
	<Domains domains={data.platform.domains} org={data.org} {submit} {feedback} />
	<Settings org={data.org} {submit} {feedback} />
{/if}
