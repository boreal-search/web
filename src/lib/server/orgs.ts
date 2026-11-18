// Org management: form-input normalisation, corpus grants and the invite email. The database
// (RLS + `add_org_member`) is the authority; the parsers only give users an early, clear error.
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { ORG_ROLES } from '#lib/roles.js';
import type { Database, OrgRole } from '#lib/supabase/types.js';
import { escapeHtml, type Email } from './email.js';

/** Mirrors `orgs.slug`'s check constraint. */
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;
/** Mirrors `org_domains.domain`. */
const DOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function parseSlug(value: FormDataEntryValue | null): string | null {
	const slug = String(value ?? '')
		.trim()
		.toLowerCase();
	return SLUG.test(slug) ? slug : null;
}

/** Accepts `acme.com`, `@acme.com` or `ACME.com `; returns `acme.com` or null. */
export function parseDomain(value: FormDataEntryValue | null): string | null {
	const domain = String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/^@/, '');
	return DOMAIN.test(domain) ? domain : null;
}

/** Free/consumer mail providers, matched on any country TLD (`yahoo.co.uk`, `gmx.de`). */
const PUBLIC_PROVIDER =
	/^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|aol|gmx|yandex|mail|zoho|proton|protonmail|tutanota|qq|163)\.(com?\.)?[a-z]{2,3}$/;
const PUBLIC_DOMAINS = new Set([
	'icloud.com',
	'me.com',
	'mac.com',
	'pm.me',
	'fastmail.com',
	'hey.com',
	'web.de'
]);

/**
 * True for well-known public email providers. Claiming one for domain auto-join would let
 * anyone with a free address join the org, so the domain form refuses them.
 */
export function isPublicEmailDomain(domain: string): boolean {
	return PUBLIC_DOMAINS.has(domain) || PUBLIC_PROVIDER.test(domain);
}

export function parseRole(value: FormDataEntryValue | null): OrgRole | null {
	return ORG_ROLES.find((r) => r === value) ?? null;
}

/**
 * Corpus grant changes for the checkbox form. Only ids the engine currently lists (`known`)
 * are touched, so a grant for a data source the engine doesn't report is never dropped by
 * an unrelated save.
 */
export function planGrantChanges(
	current: readonly string[],
	desired: readonly string[],
	known: readonly string[]
): { add: string[]; remove: string[] } {
	const has = new Set(current);
	const want = new Set(desired);
	return {
		add: known.filter((id) => want.has(id) && !has.has(id)),
		remove: known.filter((id) => has.has(id) && !want.has(id))
	};
}

/**
 * Save the checkbox form's corpus grants: an org's (`orgId`), or the public corpora (null).
 * Returns the database error, if any.
 */
export async function syncGrants(
	supabase: SupabaseClient<Database>,
	orgId: string | null,
	desired: readonly string[],
	known: readonly string[]
): Promise<PostgrestError | null> {
	const current =
		orgId === null
			? await supabase.from('public_data_sources').select('data_source_id')
			: await supabase.from('org_data_sources').select('data_source_id').eq('org_id', orgId);
	if (current.error) return current.error;

	const { add, remove } = planGrantChanges(
		current.data.map((g) => g.data_source_id),
		desired,
		known
	);
	if (add.length > 0) {
		const { error } =
			orgId === null
				? await supabase
						.from('public_data_sources')
						.insert(add.map((data_source_id) => ({ data_source_id })))
				: await supabase
						.from('org_data_sources')
						.insert(add.map((data_source_id) => ({ org_id: orgId, data_source_id })));
		if (error) return error;
	}
	if (remove.length > 0) {
		const { error } =
			orgId === null
				? await supabase.from('public_data_sources').delete().in('data_source_id', remove)
				: await supabase
						.from('org_data_sources')
						.delete()
						.eq('org_id', orgId)
						.in('data_source_id', remove);
		if (error) return error;
	}
	return null;
}

/** Invite for an email with no account yet; signing in with it claims the membership. */
export function inviteEmail(to: string, orgName: string, loginUrl: string): Email {
	const subject = `You're invited to ${orgName} on Boreal Search`;
	const text = `You've been invited to join ${orgName} on Boreal Search.\n\nSign in with ${to} to accept: ${loginUrl}\n`;
	const html =
		`<p>You've been invited to join <strong>${escapeHtml(orgName)}</strong> on Boreal Search.</p>` +
		`<p><a href="${escapeHtml(loginUrl)}">Sign in with ${escapeHtml(to)}</a> to accept.</p>`;
	return { to, subject, html, text };
}
