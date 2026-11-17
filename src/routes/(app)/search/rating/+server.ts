// POST /search/rating: set or clear the user's rating of a search or a whole trail.
// Body: `{ target: { kind: 'search' | 'trail', id }, rating: 'good' | 'bad' | null, note? }`.
// RLS decides whose searches and trails may be rated. Replies `{ error }` or 204.
import { json } from '@sveltejs/kit';
import { parseRatingRequest, setRating } from '#lib/server/ratings.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Sign in again to rate.' }, { status: 401 });
	const req = parseRatingRequest(await request.json().catch(() => null));
	if (!req) return json({ error: 'That rating is not valid.' }, { status: 400 });
	const problem = await setRating(locals.supabase, user.id, req);
	if (problem) return json({ error: problem }, { status: 400 });
	return new Response(null, { status: 204 });
};
