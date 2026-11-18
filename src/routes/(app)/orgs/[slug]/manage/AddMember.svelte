<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { ORG_ROLES, ROLE_LABELS } from '#lib/roles.js';

	let {
		submit,
		feedback
	}: {
		submit: (slot: 'add', reset?: boolean) => SubmitFunction;
		feedback: Snippet<['add']>;
	} = $props();
</script>

<section class="band" aria-labelledby="add-heading">
	<h2 id="add-heading">Add a member</h2>
	<div class="split">
		<form method="POST" action="?/addMember" class="stack" use:enhance={submit('add')}>
			<label class="field">
				Email
				<input
					type="email"
					name="email"
					required
					autocomplete="off"
					aria-describedby="add-email-help"
				/>
				<span class="help" id="add-email-help">
					Someone with a Boreal account joins now. Anyone else gets an invite email and joins when
					they sign up and confirm this address.
				</span>
			</label>
			<label class="field">
				Role
				<select name="role" aria-describedby="add-role-help">
					{#each ORG_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
				</select>
				<span class="help" id="add-role-help">You can change it later.</span>
			</label>
			{@render feedback('add')}
			<div class="actions">
				<button type="submit" class="primary">Add member</button>
			</div>
		</form>

		<dl class="roles" aria-label="Roles">
			<div>
				<dt>{ROLE_LABELS.member}</dt>
				<dd>Searches every data source this org has access to.</dd>
			</div>
			<div>
				<dt>{ROLE_LABELS.admin}</dt>
				<dd>Everything a member can, plus this page: members, roles and invites.</dd>
			</div>
			<div>
				<dt>Platform admin</dt>
				<dd>
					Boreal staff. Manages every org, including data source access, email domains and settings.
				</dd>
			</div>
		</dl>
	</div>
</section>

<style>
	.split {
		display: grid;
		gap: 1rem 3rem;
	}
	.split > form {
		margin-bottom: 0;
	}
	@media (min-width: 48rem) {
		.split {
			grid-template-columns: minmax(0, 28rem) minmax(0, 1fr);
		}
	}

	.roles {
		margin: 0;
		align-self: start;
		border-top: 1px solid var(--color-ink);
		font-size: 0.875rem;
	}
	.roles div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-rule);
	}
	.roles dt {
		font: 500 0.75rem/1.6 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.roles dd {
		margin: 0;
	}

	@media (max-width: 40rem) {
		.roles div {
			grid-template-columns: 1fr;
			gap: 0.125rem;
		}
	}
</style>
