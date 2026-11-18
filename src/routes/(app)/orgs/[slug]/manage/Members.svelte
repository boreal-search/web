<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { ORG_ROLES, ROLE_LABELS } from '#lib/roles.js';
	import RemoveCell from './RemoveCell.svelte';
	import type { PageData } from './$types';

	let {
		members,
		selfId,
		orgName,
		submit,
		feedback
	}: {
		members: PageData['members'];
		selfId: string | undefined;
		orgName: string;
		submit: (slot: 'members', reset?: boolean) => SubmitFunction;
		feedback: Snippet<['members']>;
	} = $props();
</script>

<section class="band" aria-labelledby="members-heading">
	<h2 id="members-heading">Members</h2>
	<p id="members-help" class="muted">
		Role changes and removals apply on the person's next request. An org always keeps at least one
		org admin.
	</p>
	<table class="stacked members" aria-describedby="members-help">
		<thead>
			<tr>
				<th scope="col">Member</th>
				<th scope="col">Role</th>
				<th scope="col"><span class="sr-only">Remove</span></th>
			</tr>
		</thead>
		<tbody>
			{#each members as m (m.userId)}
				{@const self = m.userId === selfId}
				<tr>
					<td data-label="Member">
						<span class="who">
							<span class="email">{m.email}</span>
							{#if self}<span class="you">you</span>{/if}
							{#if m.displayName}<span class="muted">{m.displayName}</span>{/if}
						</span>
					</td>
					<td data-label="Role">
						<form
							method="POST"
							action="?/setRole"
							class="inline"
							use:enhance={submit('members', false)}
						>
							<input type="hidden" name="email" value={m.email} />
							<select name="role" aria-label="Role for {m.email}" value={m.role}>
								{#each ORG_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
							</select>
							<button type="submit">Change</button>
						</form>
					</td>
					<RemoveCell action="?/removeMember" submit={submit('members')}>
						{#snippet summary()}{self ? 'Leave' : 'Remove'}<span class="sr-only">
								{m.email}</span
							>…{/snippet}
						<input type="hidden" name="user_id" value={m.userId} />
						<p class="help">
							{self
								? `You lose access to ${orgName} and this page on your next request.`
								: `${m.email} loses access to ${orgName} on their next request.`}
						</p>
						<button type="submit" class="danger">
							{self ? 'Remove yourself' : 'Remove member'}
						</button>
					</RemoveCell>
				</tr>
			{/each}
		</tbody>
	</table>
	{@render feedback('members')}
</section>

<style>
	.email {
		overflow-wrap: anywhere;
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.625rem;
	}
	.you {
		font: 500 0.75rem/1.4 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink);
		padding: 0 0.375rem;
		border: 1px solid var(--color-edge);
		border-radius: 3px;
	}

	.members :global(td) {
		vertical-align: middle;
	}

	form.inline {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	form.inline select {
		width: auto;
		min-width: 9rem;
	}
</style>
