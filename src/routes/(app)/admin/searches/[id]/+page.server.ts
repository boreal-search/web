import { error } from '@sveltejs/kit';
import type { RatingValue } from '#lib/rating.js';
import { requirePlatformAdmin } from '#lib/server/auth.js';
import { canRate } from '#lib/server/ratings.js';
import { reviewStep } from '#lib/server/search-review.js';
import { isUuid } from '#lib/server/trails.js';
import type { PageServerLoad } from './$types';

/**
 * One search for review: what the user saw, the other searches in the same trail (from
 * search_events, kept while the org's log_queries is on; the trail tables are owner-only), and
 * this admin's own rating when they may rate (`canRate`).
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = await requirePlatformAdmin();
	if (!isUuid(params.id)) error(404, 'Search not found');
	const { data: row, error: e } = await locals.supabase
		.from('search_review')
		.select('*')
		.eq('id', params.id)
		.eq('kind', 'search')
		.maybeSingle();
	if (e) throw e;
	if (!row?.status) error(404, 'Search not found');
	const { status } = row;

	const [conversation, mine] = await Promise.all([
		row.trail_id
			? locals.supabase
					.from('search_review')
					.select('id, step_n, query, query_length, status, rating')
					.eq('trail_id', row.trail_id)
					.order('step_n')
			: null,
		canRate(locals.supabase).then(async (rates) => {
			if (!rates) return null;
			const { data, error: e } = await locals.supabase
				.from('search_ratings')
				.select('rating, note')
				.eq('search_event_id', row.id)
				.eq('user_id', admin.id)
				.maybeSingle();
			if (e) throw e;
			return { value: data satisfies RatingValue | null };
		})
	]);
	if (conversation?.error) throw conversation.error;

	return {
		// The summary and results go once, inside `step`.
		search: { ...row, status, answer: null, results: null },
		step: reviewStep(row),
		conversation: conversation?.data ?? [],
		/** This admin's rating of the search; null when they may not rate. */
		mine
	};
};
