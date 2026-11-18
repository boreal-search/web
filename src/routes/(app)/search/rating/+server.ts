// POST /search/rating: set or clear the user's rating of a search or a whole trail.
// Body: `{ target: { kind: 'search' | 'trail', id }, rating: 'good' | 'bad' | null, note? }`.
// Platform admins only (`canRate`; RLS enforces it too). Replies `{ error }` or 204.
import { json } from '@sveltejs/kit';
import { canRate, parseRatingRequest, setRating } from '#lib/server/ratings.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Sign in again to rate.' }, { status: 401 });
	if (!(await canRate(locals.supabase)))
		return json({ error: 'Only platform admins can rate searches.' }, { status: 403 });
	const req = parseRatingRequest(await request.json().catch(() => null));
	if (!req) return json({ error: 'That rating is not valid.' }, { status: 400 });
	const problem = await setRating(locals.supabase, user.id, req);
	if (problem) return json({ error: problem }, { status: 400 });
	return new Response(null, { status: 204 });
};
