<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SubmitFunction } from '$app/forms';
	import { stamp } from '#lib/format.js';
	import { ROLE_LABELS } from '#lib/roles.js';
	import RemoveCell from './RemoveCell.svelte';
	import type { PageData } from './$types';

	let {
		invites,
		orgName,
		submit,
		feedback
	}: {
		invites: PageData['invites'];
		orgName: string;
		submit: (slot: 'invites', reset?: boolean) => SubmitFunction;
		feedback: Snippet<['invites']>;
	} = $props();
</script>

<section class="band" aria-labelledby="invites-heading">
	<h2 id="invites-heading">Pending invites</h2>
	<p id="invites-help" class="muted">
		An invite becomes a membership, with its role, when that person signs up and confirms the
		address. Revoking it cancels that.
	</p>
	{#if invites.length === 0}
		<p class="muted">No pending invites.</p>
	{:else}
		<table class="stacked" aria-describedby="invites-help">
			<thead>
				<tr>
					<th scope="col">Email</th>
					<th scope="col">Role</th>
					<th scope="col" class="num">Invited</th>
					<th scope="col"><span class="sr-only">Revoke</span></th>
				</tr>
			</thead>
			<tbody>
				{#each invites as inv (inv.email)}
					<tr>
						<td data-label="Email"><span class="email">{inv.email}</span></td>
						<td data-label="Role">{ROLE_LABELS[inv.role]}</td>
						<td data-label="Invited" class="num">
							<time datetime={inv.created_at}>{stamp(inv.created_at)}</time>
						</td>
						<RemoveCell action="?/revokeInvite" submit={submit('invites')}>
							{#snippet summary()}Revoke<span class="sr-only">
									invite for {inv.email}</span
								>…{/snippet}
							<input type="hidden" name="email" value={inv.email} />
							<p class="help">The invite email's link stops adding them to {orgName}.</p>
							<button type="submit" class="danger" aria-label="Revoke invite for {inv.email}">
								Revoke invite
							</button>
						</RemoveCell>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
	{@render feedback('invites')}
</section>

<style>
	.email {
		overflow-wrap: anywhere;
	}
</style>
