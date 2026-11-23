import { requirePlatformAdmin } from '#lib/server/auth.js';
import {
	DEFAULT_SORT,
	EXPORT_MAX,
	SELECTED_MAX,
	OUTCOMES,
	parseReviewQuery,
	reviewRows,
	reviewSearch,
	sortBy,
	SORT_KEYS,
	type SortKey
} from '#lib/server/search-review.js';
import { PAGE_SIZE, pageRange, pageWindow } from '#lib/server/users.js';
import type { PageServerLoad } from './$types';

/** PostgREST: offset past the last row (416). */
const RANGE_NOT_SATISFIABLE = 'PGRST103';

const COLUMNS =
	'kind, id, created_at, user_id, org_id, org_name, user_email, query, query_length, data_source_ids, status, result_count, retrieval_ms, total_ms, step_n, engine_version, rating, note, rated_by, trail_rating, trail_note';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePlatformAdmin();
	const query = parseReviewQuery(url.searchParams);
	const { from, to } = pageRange(query.page);

	// RLS: platform admins read every search, profile, org and rating (search_review is invoker).
	const rows = () => reviewRows(locals.supabase, COLUMNS, query, 'exact');

	const [pageResult, orgs] = await Promise.all([
		rows().range(from, to),
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

	const firstPage = reviewSearch(query, 1);
	return {
		query,
		outcomes: OUTCOMES,
		/** `?…` for each page of this view (`filtered`: any filter is set; `sorted`: not newest first). */
		pages: {
			first: firstPage,
			previous: reviewSearch(query, query.page - 1),
			next: reviewSearch(query, query.page + 1)
		},
		/** `?…` for this view sorted by each column (a second click flips it). */
		sorts: Object.fromEntries(
			SORT_KEYS.map((k) => [k, reviewSearch(query, 1, sortBy(query.sort, k))])
		) as Record<SortKey, string>,
		/** Most searches the JSON export of this view (`export` + `pages.first`) holds. */
		exportMax: EXPORT_MAX,
		/** Most picked searches one export holds. */
		selectedMax: SELECTED_MAX,
		filtered: reviewSearch({ ...query, sort: DEFAULT_SORT }, 1) !== '',
		sorted: query.sort.key !== DEFAULT_SORT.key || query.sort.dir !== DEFAULT_SORT.dir,
		total,
		pageSize: PAGE_SIZE,
		window: pageWindow(query.page, total),
		orgs: orgs.data,
		searches
	};
};
