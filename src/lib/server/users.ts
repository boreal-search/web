// /admin/users: query parsing, page math and the PostgREST search filter. Pure; the load does
// the queries and RLS decides who may read them.

export const PAGE_SIZE = 50;

/** Longest search kept; anything after is dropped. */
const MAX_QUERY = 200;
/** Pages past this are treated as out of range rather than sent as a huge offset. */
const MAX_PAGE = 100_000;

export interface UsersQuery {
	/** Trimmed search text, '' for none. */
	q: string;
	/** 1-based. */
	page: number;
}

/** `?q=` and `?page=` from the URL. A missing, malformed or < 1 page is page 1. */
export function parseUsersQuery(params: URLSearchParams): UsersQuery {
	const q = (params.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY);
	const raw = params.get('page') ?? '';
	const n = /^\d+$/.test(raw) ? Number(raw) : 1;
	return { q, page: Math.min(Math.max(n, 1), MAX_PAGE) };
}

/** Rows `from`..`to` (0-based, inclusive) of a page, for `.range()`. */
export function pageRange(page: number, size = PAGE_SIZE) {
	const from = (page - 1) * size;
	return { from, to: from + size - 1 };
}

export interface PageWindow {
	/** 1-based positions of the first and last row shown; 0 when nothing is shown. */
	first: number;
	last: number;
	pageCount: number;
	/** The page asked for is past the last page (and there are rows to show elsewhere). */
	outOfRange: boolean;
	hasPrevious: boolean;
	hasNext: boolean;
}

/** Where a page sits in `total` rows. */
export function pageWindow(page: number, total: number, size = PAGE_SIZE): PageWindow {
	const pageCount = Math.ceil(total / size);
	const outOfRange = total > 0 && page > pageCount;
	const shown = outOfRange ? 0 : Math.max(0, Math.min(size, total - (page - 1) * size));
	const first = shown === 0 ? 0 : (page - 1) * size + 1;
	return {
		first,
		last: shown === 0 ? 0 : first + shown - 1,
		pageCount,
		outOfRange,
		hasPrevious: page > 1 && !outOfRange,
		hasNext: page < pageCount
	};
}

/** Escape LIKE's own wildcards (and its escape character) so the text matches literally. */
export function escapeLike(s: string): string {
	return s.replace(/[\\%_]/g, '\\$&');
}

/**
 * A PostgREST `or` filter: any of `columns` contains `q`, case-insensitively. The pattern is
 * double-quoted so commas, dots and parentheses in the text don't break the filter; inside the
 * quotes PostgREST reads a backslash as an escape, so backslashes and quotes are escaped again.
 * PostgREST also reads `*` in a like pattern as `%`, and that can't be escaped, so a literal `*`
 * matches anything.
 */
export function containsFilter(columns: readonly string[], q: string): string {
	const pattern = `%${escapeLike(q)}%`.replace(/[\\"]/g, '\\$&');
	return columns.map((c) => `${c}.ilike."${pattern}"`).join(',');
}
