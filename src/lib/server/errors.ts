// Unexpected errors (a thrown Supabase error, a bug): log once with a short reference and give
// the error page a calm `internal` failure carrying it, so support can match a screenshot to
// the log line. Expected errors (`error(404, …)`, SvelteKit's own 404s) keep their defaults:
// the route's attached failure, or the status. Wired in hooks.server.ts.
import type { HandleServerError } from '@sveltejs/kit/hooks';

/** Eight hex characters: short enough to read out, unique enough within a day of logs. */
export const newRef = () => crypto.randomUUID().replaceAll('-', '').slice(0, 8);

export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	const ref = newRef();
	const at = new Date().toISOString();
	console.error(
		`[boreal] ref=${ref} at=${at} ${event.request.method} ${event.url.pathname}`,
		`vercel=${event.request.headers.get('x-vercel-id') ?? '-'}`,
		error
	);
	return { failure: { kind: 'internal', ref, at } };
};
