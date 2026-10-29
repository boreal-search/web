<script lang="ts">
	/* eslint-disable max-lines -- TODO: split into section components (members, invites,
	   platform-only sections) to get under 300 lines. */
	import { enhance, type SubmitFunction } from '$app/forms';
	import FailureNotice from '#lib/components/FailureNotice.svelte';
	import { plural, stamp } from '#lib/format.js';
	import { ORG_ROLES, ROLE_LABELS } from '#lib/roles.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Where an action's notice or error is shown: next to the form that sent it. */
	type Slot = 'members' | 'add' | 'invites' | 'grants' | 'domains' | 'settings';
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
	let granted = $derived(new Set(data.platform?.grantedIds ?? []));
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

{#snippet scope()}
	<p class="scope"><span>Platform admin only</span> Org admins don't see this section.</p>
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
</div>

{@render feedback(null)}

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
			{#each data.members as m (m.userId)}
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
					<td class="end">
						<details class="confirm">
							<summary>{self ? 'Leave' : 'Remove'}<span class="sr-only"> {m.email}</span>…</summary>
							<form method="POST" action="?/removeMember" use:enhance={submit('members')}>
								<input type="hidden" name="user_id" value={m.userId} />
								<p class="help">
									{self
										? `You lose access to ${data.org.name} and this page on your next request.`
										: `${m.email} loses access to ${data.org.name} on their next request.`}
								</p>
								<button type="submit" class="danger">
									{self ? 'Remove yourself' : 'Remove member'}
								</button>
							</form>
						</details>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{@render feedback('members')}
</section>

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

<section class="band" aria-labelledby="invites-heading">
	<h2 id="invites-heading">Pending invites</h2>
	<p id="invites-help" class="muted">
		An invite becomes a membership, with its role, when that person signs up and confirms the
		address. Revoking it cancels that.
	</p>
	{#if data.invites.length === 0}
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
				{#each data.invites as inv (inv.email)}
					<tr>
						<td data-label="Email"><span class="email">{inv.email}</span></td>
						<td data-label="Role">{ROLE_LABELS[inv.role]}</td>
						<td data-label="Invited" class="num">
							<time datetime={inv.created_at}>{stamp(inv.created_at)}</time>
						</td>
						<td class="end">
							<details class="confirm">
								<summary>Revoke<span class="sr-only"> invite for {inv.email}</span>…</summary>
								<form method="POST" action="?/revokeInvite" use:enhance={submit('invites')}>
									<input type="hidden" name="email" value={inv.email} />
									<p class="help">The invite email's link stops adding them to {data.org.name}.</p>
									<button type="submit" class="danger" aria-label="Revoke invite for {inv.email}">
										Revoke invite
									</button>
								</form>
							</details>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
	{@render feedback('invites')}
</section>

{#if data.platform}
	<section class="band" aria-labelledby="grants-heading">
		<h2 id="grants-heading">Data source access</h2>
		{@render scope()}
		{#if data.platform.engineFailure}
			<FailureNotice
				failure={data.platform.engineFailure}
				effect="The data source list can't be loaded, so access can't be changed."
			/>
			<p class="readout">
				<span>granted <b>{data.platform.grantedIds.join(', ') || 'none'}</b></span>
			</p>
		{:else if data.platform.dataSources.length === 0}
			<p class="empty">The search engine has no data sources.</p>
		{:else}
			<form method="POST" action="?/saveGrants" class="stack" use:enhance={submit('grants', false)}>
				<fieldset aria-describedby="grants-help">
					<legend>Data sources this org can search</legend>
					{#each data.platform.dataSources as ds (ds.id)}
						<label class="check">
							<input
								type="checkbox"
								name="data_source_id"
								value={ds.id}
								checked={granted.has(ds.id)}
							/>
							{ds.name}
						</label>
					{/each}
					<span class="help" id="grants-help">
						Every member can search every document in a checked data source. Unchecking removes that
						access on their next request.
					</span>
				</fieldset>
				{@render feedback('grants')}
				<div class="actions">
					<button type="submit" class="primary">Save access</button>
				</div>
			</form>
		{/if}
	</section>

	<section class="band" aria-labelledby="domains-heading">
		<h2 id="domains-heading">Email domains</h2>
		{@render scope()}
		<p id="domains-help" class="muted">
			Anyone who confirms an address at one of these domains (a new account or an email change)
			joins {data.org.name} as <strong>{ROLE_LABELS[data.org.default_role]}</strong>, the role set
			in Settings. Existing accounts aren't added; add them by email. A domain belongs to one org
			only, and public providers like gmail.com are refused.
		</p>
		{#if data.platform.domains.length > 0}
			<table class="stacked domains">
				<thead>
					<tr>
						<th scope="col">Domain</th>
						<th scope="col"><span class="sr-only">Remove</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.platform.domains as domain (domain)}
						<tr>
							<td data-label="Domain"><span class="email">@{domain}</span></td>
							<td class="end">
								<details class="confirm">
									<summary>Remove<span class="sr-only"> @{domain}</span>…</summary>
									<form method="POST" action="?/removeDomain" use:enhance={submit('domains')}>
										<input type="hidden" name="domain" value={domain} />
										<p class="help">
											New sign-ups from @{domain} stop joining. Current members stay.
										</p>
										<button type="submit" class="danger" aria-label="Remove @{domain}">
											Remove domain
										</button>
									</form>
								</details>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
		<form method="POST" action="?/addDomain" class="stack" use:enhance={submit('domains')}>
			<label class="field">
				Domain
				<input
					name="domain"
					placeholder="acme.com"
					required
					autocomplete="off"
					aria-describedby="domain-help"
				/>
				<span class="help" id="domain-help">The part after the @, like acme.com.</span>
			</label>
			{@render feedback('domains')}
			<div class="actions">
				<button type="submit" class="primary">Add domain</button>
			</div>
		</form>
	</section>

	<section class="band" aria-labelledby="settings-heading">
		<h2 id="settings-heading">Settings</h2>
		{@render scope()}
		<form
			method="POST"
			action="?/saveSettings"
			class="stack"
			use:enhance={submit('settings', false)}
		>
			<label class="field">
				Role for domain sign-ups
				<select
					name="default_role"
					value={data.org.default_role}
					aria-describedby="default-role-help"
				>
					{#each ORG_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
				</select>
				<span class="help" id="default-role-help">
					For people who join through an email domain. Invites keep the role they were sent with,
					and existing members don't change.
				</span>
			</label>
			<div class="field">
				<label class="check">
					<input
						type="checkbox"
						name="log_queries"
						checked={data.org.log_queries}
						aria-describedby="log-queries-help"
					/>
					Store query text in search analytics
				</label>
				<span class="help" id="log-queries-help">
					Every search is logged either way. When off, the query text isn't stored: only its length,
					the data sources, result count, top score, time and outcome. Applies to new searches.
				</span>
			</div>
			<div class="field">
				<label class="check">
					<input
						type="checkbox"
						name="conversation_history"
						checked={data.org.conversation_history}
						aria-describedby="conversation-history-help"
					/>
					Keep search trails
				</label>
				<span class="help" id="conversation-history-help">
					Members' searches are kept as trails they can reread, share and export. When off, a trail
					lasts only while the page is open. Applies to new searches; existing trails stay until
					their owners delete them.
				</span>
			</div>
			{@render feedback('settings')}
			<div class="actions">
				<button type="submit" class="primary">Save settings</button>
			</div>
		</form>
	</section>
{/if}

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

	.members td,
	.domains td {
		vertical-align: middle;
	}
	td.end {
		text-align: right;
		width: 1%;
		white-space: nowrap;
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

	/* Two-step destructive action without a dialog: "Remove…" reveals the danger button. */
	.confirm summary {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0;
		list-style: none;
		color: var(--color-muted);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
	}
	.confirm summary::-webkit-details-marker {
		display: none;
	}
	.confirm[open] summary {
		color: var(--color-ink);
	}
	.confirm form {
		display: grid;
		justify-items: end;
		gap: 0.5rem;
		width: 16rem;
		max-width: 100%;
		margin-left: auto;
		padding-bottom: 0.5rem;
		white-space: normal;
		text-align: right;
	}
	.confirm .help {
		margin: 0;
	}

	.scope {
		margin: -0.5rem 0 1rem;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.scope span {
		margin-right: 0.5rem;
		font: 500 0.75rem/1.4 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink);
	}

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
		td.end {
			width: auto;
			text-align: left;
		}
		.confirm form {
			justify-items: start;
			margin-left: 0;
			text-align: left;
		}
		.roles div {
			grid-template-columns: 1fr;
			gap: 0.125rem;
		}
	}
</style>
