// Org management: form-input normalisation and the invite email. Pure; the database
// (RLS + `add_org_member`) is the authority, these only give users an early, clear error.
import type { OrgRole } from '#lib/supabase/types.js';
import type { Email } from './email.js';

/** Mirrors `orgs.slug`'s check constraint. */
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;
/** Mirrors `org_invites.email` / `add_org_member`. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Mirrors `org_domains.domain`. */
const DOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const ROLES: readonly OrgRole[] = ['owner', 'member'];

export function parseSlug(value: FormDataEntryValue | null): string | null {
	const slug = String(value ?? '')
		.trim()
		.toLowerCase();
	return SLUG.test(slug) ? slug : null;
}

export function parseEmail(value: FormDataEntryValue | null): string | null {
	const email = String(value ?? '')
		.trim()
		.toLowerCase();
	return EMAIL.test(email) ? email : null;
}

/** Accepts `acme.com`, `@acme.com` or `ACME.com `; returns `acme.com` or null. */
export function parseDomain(value: FormDataEntryValue | null): string | null {
	const domain = String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/^@/, '');
	return DOMAIN.test(domain) ? domain : null;
}

export function parseRole(value: FormDataEntryValue | null): OrgRole | null {
	return ROLES.find((r) => r === value) ?? null;
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

const escapeHtml = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
	);

/** Invite for an email with no account yet; signing in with it claims the membership. */
export function inviteEmail(to: string, orgName: string, loginUrl: string): Email {
	const subject = `You're invited to ${orgName} on Boreal Search`;
	const text = `You've been invited to join ${orgName} on Boreal Search.\n\nSign in with ${to} to accept: ${loginUrl}\n`;
	const html =
		`<p>You've been invited to join <strong>${escapeHtml(orgName)}</strong> on Boreal Search.</p>` +
		`<p><a href="${escapeHtml(loginUrl)}">Sign in with ${escapeHtml(to)}</a> to accept.</p>`;
	return { to, subject, html, text };
}
