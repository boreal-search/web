// /admin/searches/export: searches as JSON (src/lib/server/search-export.ts). Platform admins
// only; RLS on search_review says the same. Conversation rows (a trail rating with no linked
// search) carry no search, so they're left out.
//   GET: the /admin/searches view (same URL params), every matching search up to EXPORT_MAX.
//   POST: the searches picked in the table (form fields `id`), up to SELECTED_MAX, newest first.
import { error } from '@sveltejs/kit';
import { requirePlatformAdmin } from '#lib/server/auth.js';
import {
	EXPORT_COLUMNS,
	EXPORT_TAIL,
	exportEntry,
	exportHead,
	type ExportRow,
	type ExportScope
} from '#lib/server/search-export.js';
import {
	EXPORT_MAX,
	parseReviewQuery,
	reviewRows,
	reviewSearch,
	SELECTED_MAX,
	type ReviewQuery
} from '#lib/server/search-review.js';
import { isUuid } from '#lib/server/trails.js';
import type { SearchStatus } from '#lib/supabase/types.js';
import type { RequestHandler } from './$types';

/** Rows asked for per request (supabase/config.toml max_rows). */
const CHUNK = 1000;
/** Ids per `in` filter: each is 37 characters of the request URL. */
const ID_CHUNK = 100;

type Db = App.Locals['supabase'];
type Searched = ExportRow & { status: SearchStatus };
const searches = (rows: ExportRow[]) => rows.filter((r): r is Searched => r.status !== null);

const searchRows = (db: Db, query: ReviewQuery) =>
	reviewRows(db, EXPORT_COLUMNS, query).eq('kind', 'search');

/**
 * The view's rows from `from`, as many as PostgREST gives (it may cap below CHUNK). Rows recorded
 * after `startedAt` would shift the offsets while the export runs, so they are left out.
 */
async function viewRows(db: Db, query: ReviewQuery, startedAt: string, from: number) {
	const { data, error: e } = await searchRows(db, query)
		.lte('created_at', startedAt)
		.range(from, Math.min(from + CHUNK, EXPORT_MAX) - 1);
	if (e) throw e;
	return data;
}

/** The picked searches, whatever the filters, newest first. */
async function selectedRows(db: Db, ids: string[]): Promise<Searched[]> {
	const newest = parseReviewQuery(new URLSearchParams());
	const chunks = Array.from({ length: Math.ceil(ids.length / ID_CHUNK) }, (_, i) =>
		ids.slice(i * ID_CHUNK, (i + 1) * ID_CHUNK)
	);
	const results = await Promise.all(chunks.map((c) => searchRows(db, newest).in('id', c)));
	const rows = results.flatMap(({ data, error: e }) => {
		if (e) throw e;
		return searches(data);
	});
	return rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

function download(scope: ExportScope, body: BodyInit) {
	const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
	const name = 'selected' in scope ? 'boreal-searches-selected' : 'boreal-searches';
	return new Response(body, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${name}-${stamp}.json"`,
			'cache-control': 'no-store'
		}
	});
}

const encoder = new TextEncoder();

export const GET: RequestHandler = async ({ locals, url }) => {
	await requirePlatformAdmin();
	const query = parseReviewQuery(url.searchParams);
	const startedAt = new Date().toISOString();
	const next = (from: number) => viewRows(locals.supabase, query, startedAt, from);
	const scope = { view: reviewSearch(query, 1) };

	// The first rows before the response starts, so a failing query is an error page, not a
	// broken download. Then one chunk per pull: the body is never held whole.
	let rows = await next(0);
	let sent = 0;
	let written = 0;
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(exportHead(scope, startedAt)));
		},
		async pull(controller) {
			if (rows.length === 0) {
				controller.enqueue(encoder.encode(EXPORT_TAIL));
				return controller.close();
			}
			const chunk = searches(rows).map((r) => exportEntry(r, written++ === 0));
			controller.enqueue(encoder.encode(chunk.join('')));
			sent += rows.length;
			try {
				rows = sent < EXPORT_MAX ? await next(sent) : [];
			} catch (e) {
				// Headers are already sent, so the download can only be cut off; log why.
				console.error(`search export failed after ${sent} rows`, e);
				controller.error(e);
			}
		}
	});
	return download(scope, body);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	await requirePlatformAdmin();
	const form = await request.formData();
	const ids = [
		...new Set(form.getAll('id').filter((v): v is string => typeof v === 'string' && isUuid(v)))
	];
	if (ids.length === 0) error(400, 'Pick at least one search to export.');
	if (ids.length > SELECTED_MAX)
		error(400, `Pick at most ${SELECTED_MAX} searches, or export the whole view.`);

	const exportedAt = new Date().toISOString();
	const rows = await selectedRows(locals.supabase, ids);
	const scope = { selected: rows.length };
	const entries = rows.map((r, i) => exportEntry(r, i === 0)).join('');
	return download(scope, exportHead(scope, exportedAt) + entries + EXPORT_TAIL);
};
