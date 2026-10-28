// App emails via Resend's REST API (no SDK: one POST). Auth emails (magic links) do NOT go
// through here; Supabase sends those over its SMTP setting (smtp.resend.com).
import { EMAIL_FROM, RESEND_API_KEY } from '$app/env/private';

const RESEND_URL = 'https://api.resend.com/emails';

export interface Email {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
}

export class EmailError extends Error {
	constructor(
		/** HTTP status from Resend; 0 = not configured or the request never got a response. */
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'EmailError';
	}
}

/** Send one email. Resolves with Resend's message id; throws `EmailError` otherwise. */
export async function sendEmail(
	email: Email,
	fetchFn: typeof fetch = fetch
): Promise<{ id: string }> {
	if (!RESEND_API_KEY || !EMAIL_FROM) {
		throw new EmailError(0, 'Email is not configured: set RESEND_API_KEY and EMAIL_FROM');
	}

	let res: Response;
	try {
		res = await fetchFn(RESEND_URL, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${RESEND_API_KEY}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ from: EMAIL_FROM, ...email })
		});
	} catch (e) {
		throw new EmailError(0, `Resend unreachable: ${e instanceof Error ? e.message : String(e)}`);
	}

	const body: unknown = await res.json().catch(() => null);
	if (!res.ok) {
		const message =
			body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
				? body.message
				: res.statusText || 'request failed';
		throw new EmailError(res.status, `Resend ${res.status}: ${message}`);
	}
	if (!body || typeof body !== 'object' || !('id' in body) || typeof body.id !== 'string') {
		throw new EmailError(res.status, 'Resend response had no message id');
	}
	return { id: body.id };
}
