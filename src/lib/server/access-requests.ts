// Access requests: a signed-in user with no org asks for their organization's documents.
// Input parsing and the support email are pure; the database (RLS, checks, the one-open
// index) is the authority. Founders act on requests from /admin.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/supabase/types.js';
import { escapeHtml, type Email } from './email.js';

export const SUPPORT_EMAIL = 'support@borealsearch.app';

/** Mirror `access_requests`' check constraints (characters, as Postgres counts them). */
const LIMITS = { organization: 200, role: 200, useCase: 2000 } as const;

interface AccessRequestInput {
	organization: string;
	role: string | null;
	useCase: string;
}

export type AccessRequestField = keyof AccessRequestInput;

type ParsedAccessRequest =
	| { ok: true; value: AccessRequestInput }
	| {
			ok: false;
			/** What the user typed, normalised, to refill the form. */
			values: { organization: string; role: string; useCase: string };
			errors: Partial<Record<AccessRequestField, string>>;
	  };

/** An open request, as the requester sees it. */
export interface OpenAccessRequest {
	email: string;
	organization: string;
	createdAt: string;
}

const chars = (s: string) => [...s].length;
/** One line: trimmed, inner whitespace (including newlines) collapsed to single spaces. */
const line = (v: FormDataEntryValue | null) =>
	String(v ?? '')
		.replace(/\s+/g, ' ')
		.trim();
/** Free text: trimmed, line endings normalised, line breaks kept. */
const prose = (v: FormDataEntryValue | null) =>
	String(v ?? '')
		.replace(/\r\n?/g, '\n')
		.trim();

const tooLong = (max: number) => `Use ${max.toLocaleString('en-CA')} characters or fewer.`;

export function parseAccessRequest(form: FormData): ParsedAccessRequest {
	const organization = line(form.get('organization'));
	const role = line(form.get('role'));
	const useCase = prose(form.get('use_case'));

	const errors: Partial<Record<AccessRequestField, string>> = {};
	if (!organization) errors.organization = "Enter your organization's name.";
	else if (chars(organization) > LIMITS.organization)
		errors.organization = tooLong(LIMITS.organization);
	if (chars(role) > LIMITS.role) errors.role = tooLong(LIMITS.role);
	if (!useCase) errors.useCase = 'Say which documents you want to search, and why.';
	else if (chars(useCase) > LIMITS.useCase) errors.useCase = tooLong(LIMITS.useCase);

	if (Object.keys(errors).length > 0) {
		return { ok: false, values: { organization, role, useCase }, errors };
	}
	return { ok: true, value: { organization, role: role || null, useCase } };
}

/** The notification to support. Replies go to the requester. */
export function accessRequestEmail(
	request: AccessRequestInput & { email: string },
	adminUrl: string
): Email {
	const role = request.role ?? 'not given';
	const text =
		`Access request on Boreal Search.\n\n` +
		`Email: ${request.email}\n` +
		`Organization: ${request.organization}\n` +
		`Role: ${role}\n\n` +
		`Use case:\n${request.useCase}\n\n` +
		`Review open requests: ${adminUrl}\n`;
	const html =
		`<p>Access request on Boreal Search.</p>` +
		`<p>Email: ${escapeHtml(request.email)}<br>` +
		`Organization: ${escapeHtml(request.organization)}<br>` +
		`Role: ${escapeHtml(role)}</p>` +
		`<p>Use case:</p><p style="white-space: pre-line">${escapeHtml(request.useCase)}</p>` +
		`<p><a href="${escapeHtml(adminUrl)}">Review open requests</a></p>`;
	return {
		to: SUPPORT_EMAIL,
		reply_to: request.email,
		subject: `Access request: ${request.organization}`,
		text,
		html
	};
}

/** The user's open request, if any. */
export async function loadAccessRequest(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<OpenAccessRequest | null> {
	const { data, error } = await supabase
		.from('access_requests')
		.select('email, organization, created_at')
		.eq('user_id', userId)
		.eq('status', 'open')
		.maybeSingle();
	if (error) throw error;
	return data && { email: data.email, organization: data.organization, createdAt: data.created_at };
}
