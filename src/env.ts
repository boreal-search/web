import { building } from '$app/env';
import { defineEnvVars } from '@sveltejs/kit/env';

// Dev/preview: read from `.env`. Prod: Vercel project env vars (Production + Preview scopes).
// Private vars are only importable from server-only modules via `$app/env/private`.
// Values are dynamic (read at runtime), so they are only required when the app starts, not at build.
function required(name: string) {
	return (value: string | undefined): string => {
		if (building) return value ?? '';
		if (!value) throw new Error(`${name} is required`);
		return value;
	};
}

/** Unset or empty → `undefined`; the consumer decides whether that is an error. */
const optional = (value: string | undefined): string | undefined => value || undefined;

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		description: 'Supabase project URL',
		schema: required('PUBLIC_SUPABASE_URL')
	},
	PUBLIC_SUPABASE_ANON_KEY: {
		public: true,
		description: 'Supabase anon / publishable key (safe for the browser; RLS enforces access)',
		schema: required('PUBLIC_SUPABASE_ANON_KEY')
	},
	ENGINE_URL: {
		description: 'Base URL of the boreal engine API (reached through the Cloudflare Tunnel)',
		schema: required('ENGINE_URL')
	},
	ENGINE_SERVICE_TOKEN: {
		description: 'Bearer token for engine requests. Server-only. Never send to the browser.',
		schema: required('ENGINE_SERVICE_TOKEN')
	},
	FILE_SIGNING_KEY: {
		description:
			"HMAC key for engine `/files/` URLs (same value as the engine's). Server-only, optional: without it, permanent page links fall back to the engine's signed URLs.",
		schema: optional
	},
	RESEND_API_KEY: {
		description:
			'Resend API key for app emails. Server-only, optional (sendEmail throws if unset).',
		schema: optional
	},
	EMAIL_FROM: {
		description:
			'Sender for app emails, e.g. `Boreal Search <support@borealsearch.app>`. Optional.',
		schema: optional
	}
});
