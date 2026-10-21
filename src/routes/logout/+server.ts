import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** POST only, so a stray GET (prefetch, crawler) can't log the user out. */
export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	redirect(303, '/login');
};
