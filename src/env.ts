import { building } from '$app/env';
import { defineEnvVars } from '@sveltejs/kit/env';

// Dev: read from `.env`. Preview (`wrangler dev`): `.dev.vars`. Prod: Workers secrets.
// Private vars are only importable from server-only modules via `$app/env/private`.
// Values are dynamic (read at runtime), so they are only required when the app starts, not at build.
function required(name: string) {
	return (value: string | undefined): string => {
		if (building) return value ?? '';
		if (!value) throw new Error(`${name} is required`);
		return value;
	};
}

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
	}
});
