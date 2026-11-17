import { error } from '@sveltejs/kit';
import { requirePlatformAdmin } from '#lib/server/auth.js';
import { reviewStep } from '#lib/server/search-review.js';
import { isUuid } from '#lib/server/trails.js';
import type { PageServerLoad } from './$types';

/**
 * One search for review: what the user saw, the other searches in the same trail (from
 * search_events: trails stay private to their owner), and this admin's own verdict.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = await requirePlatformAdmin();
	if (!isUuid(params.id)) error(404, 'Search not found');
	const { data: row, error: e } = await locals.supabase
		.from('search_review')
		.select('*')
		.eq('id', params.id)
		.maybeSingle();
	if (e) throw e;
	if (!row) error(404, 'Search not found');

	const [conversation, mine] = await Promise.all([
		row.trail_id
			? locals.supabase
					.from('search_review')
					.select('id, step_n, query, query_length, status, user_rating, review_rating')
					.eq('trail_id', row.trail_id)
					.order('step_n')
			: null,
		locals.supabase
			.from('search_ratings')
			.select('rating, note')
			.eq('search_event_id', row.id)
			.eq('user_id', admin.id)
			.maybeSingle()
	]);
	if (conversation?.error) throw conversation.error;
	if (mine.error) throw mine.error;

	return {
		// The summary and results go once, inside `step`.
		search: { ...row, answer: null, results: null },
		step: reviewStep(row),
		conversation: conversation?.data ?? [],
		/** The searcher is reviewing their own search: their rating is the user's, not a verdict. */
		ownSearch: row.user_id === admin.id,
		verdict: mine.data
	};
};
