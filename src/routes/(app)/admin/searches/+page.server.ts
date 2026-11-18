import { requirePlatformAdmin } from '#lib/server/auth.js';
import { OUTCOMES, parseReviewQuery, reviewSearch } from '#lib/server/search-review.js';
import { containsFilter, PAGE_SIZE, pageRange, pageWindow } from '#lib/server/users.js';
import type { PageServerLoad } from './$types';

/** PostgREST: offset past the last row (416). */
const RANGE_NOT_SATISFIABLE = 'PGRST103';

const COLUMNS =
	'id, created_at, org_id, org_name, user_email, query, query_length, data_source_ids, status, result_count, retrieval_ms, total_ms, step_n, rating, note, rated_by, trail_rating';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePlatformAdmin();
	const query = parseReviewQuery(url.searchParams);
	const { from, to } = pageRange(query.page);

	// RLS: platform admins read every search, profile, org and rating (search_review is invoker).
	const rows = () => {
		let q = locals.supabase.from('search_review').select(COLUMNS, { count: 'exact' });
		if (query.q) q = q.or(containsFilter(['query', 'resolved_query'], query.q));
		if (query.status) q = q.eq('status', query.status);
		if (query.org)
			q = query.org.kind === 'public' ? q.is('org_id', null) : q.eq('org_id', query.org.id);
		if (query.rating === 'none') q = q.is('rating', null);
		else if (query.rating) q = q.eq('rating', query.rating);
		return q;
	};

	const [pageResult, orgs] = await Promise.all([
		rows().order('created_at', { ascending: false }).order('id').range(from, to),
		locals.supabase.from('orgs').select('id, name').order('name')
	]);
	if (orgs.error) throw orgs.error;

	let searches = pageResult.data ?? [];
	let total = pageResult.count ?? 0;
	if (pageResult.error) {
		if (pageResult.error.code !== RANGE_NOT_SATISFIABLE) throw pageResult.error;
		const head = await rows().limit(0);
		if (head.error) throw head.error;
		searches = [];
		total = head.count ?? 0;
	}

	return {
		query,
		outcomes: OUTCOMES,
		/** `?…` for each page of this view; `filtered`: any filter is set. */
		pages: {
			first: reviewSearch(query, 1),
			previous: reviewSearch(query, query.page - 1),
			next: reviewSearch(query, query.page + 1)
		},
		filtered: reviewSearch(query, 1) !== '',
		total,
		pageSize: PAGE_SIZE,
		window: pageWindow(query.page, total),
		orgs: orgs.data,
		searches
	};
};
