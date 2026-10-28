<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { OrgRole } from '#lib/supabase/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const roles: OrgRole[] = ['member', 'owner'];
	// Forms that show current state: keep the inputs, let the reloaded data drive them.
	const keep: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });
	let granted = $derived(new Set(data.admin?.grantedIds ?? []));
</script>

<h1>Manage {data.org.name}</h1>

{#if form?.error}
	<p class="error" role="alert">{form.error}</p>
{:else if form?.notice}
	<p role="status">{form.notice}</p>
{/if}

<section>
	<h2>Members</h2>
	<table>
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
								{#each roles as r (r)}<option value={r}>{r}</option>{/each}
							</select>
							<button type="submit">Change</button>
						</form>
					</td>
					<td>
						<form method="POST" action="?/removeMember" use:enhance>
							<input type="hidden" name="user_id" value={m.userId} />
							<button type="submit">Remove</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h3>Add a member</h3>
	<p class="muted">
		People without an account get an invite and join when they first sign in with that email.
	</p>
	<form method="POST" action="?/addMember" class="stack" use:enhance>
		<label>
			Email
			<input type="email" name="email" required autocomplete="off" />
		</label>
		<label>
			Role
			<select name="role">
				{#each roles as r (r)}<option value={r}>{r}</option>{/each}
			</select>
		</label>
		<button type="submit" class="primary">Add</button>
	</form>

	{#if data.invites.length > 0}
		<h3>Pending invites</h3>
		<table>
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
						<td>{inv.role}</td>
						<td>{new Date(inv.created_at).toLocaleDateString()}</td>
						<td>
							<form method="POST" action="?/revokeInvite" use:enhance>
								<input type="hidden" name="email" value={inv.email} />
								<button type="submit">Revoke</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

{#if data.admin}
	<section>
		<h2>Corpus access</h2>
		{#if data.admin.engineError}
			<p class="error" role="alert">Could not reach the engine: {data.admin.engineError}</p>
			<p class="muted">Granted: {data.admin.grantedIds.join(', ') || 'none'}</p>
		{:else if data.admin.dataSources.length === 0}
			<p class="muted">The engine has no data sources.</p>
		{:else}
			<form method="POST" action="?/saveGrants" class="stack" use:enhance={keep}>
				<fieldset>
					<legend>Data sources this org can search</legend>
					{#each data.admin.dataSources as ds (ds.id)}
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
	</section>

	<section>
		<h2>Email domains</h2>
		<p class="muted">
			New users who confirm an email on these domains join automatically as
			<strong>{data.org.default_role}</strong>.
		</p>
		{#if data.admin.domains.length > 0}
			<ul>
				{#each data.admin.domains as domain (domain)}
					<li>
						<form method="POST" action="?/removeDomain" use:enhance>
							@{domain}
							<input type="hidden" name="domain" value={domain} />
							<button type="submit">Remove</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		<form method="POST" action="?/addDomain" class="stack" use:enhance>
			<label>
				Domain
				<input name="domain" placeholder="acme.com" required />
			</label>
			<button type="submit">Add domain</button>
		</form>
	</section>

	<section>
		<h2>Settings</h2>
		<form method="POST" action="?/saveSettings" class="stack" use:enhance={keep}>
			<label>
				<input type="checkbox" name="log_queries" checked={data.org.log_queries} />
				Store query text in search analytics
			</label>
			<label>
				Role for domain auto-joins
				<select name="default_role" value={data.org.default_role}>
					{#each roles as r (r)}<option value={r}>{r}</option>{/each}
				</select>
			</label>
			<button type="submit" class="primary">Save settings</button>
		</form>
	</section>
{/if}
