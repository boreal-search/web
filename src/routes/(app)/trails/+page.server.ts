// The user's trails, and those shared with them. Reopening one is /search?trail=<id>.
import { fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { deleteTrail, listTrails } from '#lib/server/trails.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser();
	return { trails: await listTrails(locals.supabase, user.id) };
};

export const actions: Actions = {
	/** Owner only (RLS). Posts `trail_id`. */
	delete: async ({ request, locals }) => {
		requireUser();
		const id = String((await request.formData()).get('trail_id') ?? '');
		const problem = await deleteTrail(locals.supabase, id);
		if (problem) return fail(400, { error: problem });
		return { notice: 'Trail deleted.' };
	}
};
