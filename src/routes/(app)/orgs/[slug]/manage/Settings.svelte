<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { ORG_ROLES, ROLE_LABELS } from '#lib/roles.js';
	import type { PageData } from './$types';

	let {
		org,
		submit,
		feedback
	}: {
		org: PageData['org'];
		submit: (slot: 'settings', reset?: boolean) => SubmitFunction;
		feedback: Snippet<['settings']>;
	} = $props();
</script>

<section class="band" aria-labelledby="settings-heading">
	<h3 id="settings-heading">Settings</h3>
	<form method="POST" action="?/saveSettings" class="stack" use:enhance={submit('settings', false)}>
		<label class="field">
			Role for domain sign-ups
			<select name="default_role" value={org.default_role} aria-describedby="default-role-help">
				{#each ORG_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
			</select>
			<span class="help" id="default-role-help">
				For people who join through an email domain. Invites keep the role they were sent with, and
				existing members don't change.
			</span>
		</label>
		<div class="field">
			<label class="check">
				<input
					type="checkbox"
					name="conversation_history"
					checked={org.conversation_history}
					aria-describedby="conversation-history-help"
				/>
				Keep search trails
			</label>
			<span class="help" id="conversation-history-help">
				Members' searches are kept as trails they can reread, share and export. When off, a trail
				lasts only while the page is open. Applies to new searches; existing trails stay until their
				owners delete them.
			</span>
		</div>
		{@render feedback('settings')}
		<div class="actions">
			<button type="submit" class="primary">Save settings</button>
		</div>
	</form>
</section>
