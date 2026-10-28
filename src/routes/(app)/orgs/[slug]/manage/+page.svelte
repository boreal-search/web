<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { ORG_ROLES, ROLE_LABELS } from '#lib/roles.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Forms that show current state: keep the inputs, let the reloaded data drive them.
	const keep: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });
	let granted = $derived(new Set(data.platform?.grantedIds ?? []));
</script>

<h1>{data.org.name} <small class="muted">org admin</small></h1>

{#if form?.error}
	<p class="error" role="alert">{form.error}</p>
{:else if form?.notice}
	<p role="status">{form.notice}</p>
{/if}

<section aria-labelledby="roles-heading">
	<h2 id="roles-heading">Roles</h2>
	<dl>
		<dt>{ROLE_LABELS.member}</dt>
		<dd>Searches every data source this org has access to.</dd>
		<dt>{ROLE_LABELS.admin}</dt>
		<dd>
			Everything a member can, plus this page: adds and removes members, changes roles and manages
			invites. An org always keeps at least one org admin.
		</dd>
		<dt>Platform admin</dt>
		<dd>Boreal staff. Manages every org, including the sections marked "Platform admin only".</dd>
	</dl>
</section>

<section aria-labelledby="members-heading">
	<h2 id="members-heading">Members</h2>
	<p id="members-help" class="muted">
		Role changes and removals take effect on the person's next request.
	</p>
	<table aria-describedby="members-help">
		<thead>
			<tr>
				<th>Email</th>
				<th>Role</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.members as m (m.userId)}
				<tr>
					<td>
						{m.email}
						{#if m.displayName}<span class="muted">({m.displayName})</span>{/if}
					</td>
					<td>
						<form method="POST" action="?/setRole" use:enhance={keep}>
							<input type="hidden" name="email" value={m.email} />
							<select name="role" aria-label="Role for {m.email}" value={m.role}>
								{#each ORG_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
							</select>
							<button type="submit">Change</button>
						</form>
					</td>
					<td>
						<form method="POST" action="?/removeMember" use:enhance>
							<input type="hidden" name="user_id" value={m.userId} />
							<button type="submit" aria-label="Remove {m.email}">Remove</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h3>Add a member</h3>
	<form method="POST" action="?/addMember" class="stack" use:enhance>
		<label>
			Email
			<input
				type="email"
				name="email"
				required
				autocomplete="off"
				aria-describedby="add-email-help"
			/>
		</label>
		<small id="add-email-help" class="muted">
			If they already have a Boreal account they're added now. Otherwise they get an invite email
			and appear under pending invites.
		</small>
		<label>
			Role
			<select name="role">
				{#each ORG_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
			</select>
		</label>
		<button type="submit" class="primary">Add</button>
	</form>

	<h3 id="invites-heading">Pending invites</h3>
	<p id="invites-help" class="muted">
		An invite turns into a membership, with its role, when that person signs up and confirms this
		email address. Revoking it stops that.
	</p>
	{#if data.invites.length === 0}
		<p class="muted">None.</p>
	{:else}
		<table aria-labelledby="invites-heading" aria-describedby="invites-help">
			<thead>
				<tr>
					<th>Email</th>
					<th>Role</th>
					<th>Invited</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.invites as inv (inv.email)}
					<tr>
						<td>{inv.email}</td>
						<td>{ROLE_LABELS[inv.role]}</td>
						<td>{new Date(inv.created_at).toLocaleDateString()}</td>
						<td>
							<form method="POST" action="?/revokeInvite" use:enhance>
								<input type="hidden" name="email" value={inv.email} />
								<button type="submit" aria-label="Revoke invite for {inv.email}">Revoke</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

{#if data.platform}
	<section aria-labelledby="platform-heading">
		<h2 id="platform-heading">Platform admin only</h2>
		<p class="muted">Org admins don't see these sections and can't change them.</p>

		<h3>Data source access</h3>
		{#if data.platform.engineError}
			<p class="error" role="alert">{data.platform.engineError}</p>
			<p class="muted">Granted: {data.platform.grantedIds.join(', ') || 'none'}</p>
		{:else if data.platform.dataSources.length === 0}
			<p class="muted">The engine has no data sources.</p>
		{:else}
			<form method="POST" action="?/saveGrants" class="stack" use:enhance={keep}>
				<fieldset aria-describedby="grants-help">
					<legend>Data sources this org can search</legend>
					<small id="grants-help" class="muted">
						Every member of the org can search every document in a checked data source. Unchecking
						removes that access on their next request.
					</small>
					{#each data.platform.dataSources as ds (ds.id)}
						<label>
							<input
								type="checkbox"
								name="data_source_id"
								value={ds.id}
								checked={granted.has(ds.id)}
							/>
							{ds.name}
						</label>
					{/each}
				</fieldset>
				<button type="submit" class="primary">Save access</button>
			</form>
		{/if}

		<h3>Email domains</h3>
		<p id="domains-help" class="muted">
			Anyone who confirms an email address at one of these domains (a new account, or an email
			change) joins {data.org.name} automatically as
			<strong>{ROLE_LABELS[data.org.default_role]}</strong> (the default role below). Existing accounts
			aren't added; add them by email. A domain can belong to one org only. Public providers like gmail.com
			are refused.
		</p>
		{#if data.platform.domains.length > 0}
			<ul>
				{#each data.platform.domains as domain (domain)}
					<li>
						<form method="POST" action="?/removeDomain" use:enhance>
							@{domain}
							<input type="hidden" name="domain" value={domain} />
							<button type="submit" aria-label="Remove @{domain}">Remove</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		<form method="POST" action="?/addDomain" class="stack" use:enhance>
			<label>
				Domain
				<input name="domain" placeholder="acme.com" required aria-describedby="domains-help" />
			</label>
			<button type="submit">Add domain</button>
		</form>

		<h3>Settings</h3>
		<form method="POST" action="?/saveSettings" class="stack" use:enhance={keep}>
			<label>
				Default role
				<select
					name="default_role"
					value={data.org.default_role}
					aria-describedby="default-role-help"
				>
					{#each ORG_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
				</select>
			</label>
			<small id="default-role-help" class="muted">
				Role for people who join through an email domain. Invites keep the role they were sent with;
				existing members don't change.
			</small>
			<label>
				<input
					type="checkbox"
					name="log_queries"
					checked={data.org.log_queries}
					aria-describedby="log-queries-help"
				/>
				Store query text in search analytics
			</label>
			<small id="log-queries-help" class="muted">
				Every search is logged either way. Off: the query text is not stored, only its length, the
				data sources, result count, top score, timing and outcome. Applies to new searches.
			</small>
			<button type="submit" class="primary">Save settings</button>
		</form>
	</section>
{/if}
