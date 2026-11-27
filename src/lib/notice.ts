// Data source notices (DataSource.notice): a licence's required statement or a copyright notice,
// shown verbatim wherever the source's pages or answers appear. Plain text, never HTML: URLs
// become links by splitting the text, not by markup.

export type NoticePart = { kind: 'text'; text: string } | { kind: 'link'; text: string };

const URL = /https?:\/\/[^\s<>"]+/g;
/** Sentence punctuation after a URL, not part of it ("…gc.ca)." / "…Licence.html ."). */
const TRAILING = /[.,;:!?'"]+$/;

/** A URL as written, minus trailing punctuation and a closing bracket it doesn't open. */
function trimUrl(url: string): string {
	let u = url.replace(TRAILING, '');
	while (u.endsWith(')') && count(u, '(') < count(u, ')')) u = u.slice(0, -1).replace(TRAILING, '');
	return u;
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

/** The notice as text and link parts, in order; joined they are the notice unchanged. */
export function noticeParts(notice: string): NoticePart[] {
	const parts: NoticePart[] = [];
	let at = 0;
	for (const m of notice.matchAll(URL)) {
		const link = trimUrl(m[0]);
		if (link.length <= 'https://'.length) continue;
		if (m.index > at) parts.push({ kind: 'text', text: notice.slice(at, m.index) });
		parts.push({ kind: 'link', text: link });
		at = m.index + link.length;
	}
	if (at < notice.length) parts.push({ kind: 'text', text: notice.slice(at) });
	return parts;
}

/** Data sources the answer's citations point into, read off the results' documents. */
export function citedDataSources(
	citations: readonly { document_id: string }[],
	results: readonly { document_id: string; data_source_id: string }[]
): string[] {
	const sourceOf = new Map(results.map((r) => [r.document_id, r.data_source_id]));
	return citations.flatMap((c) => sourceOf.get(c.document_id) ?? []);
}

/** Each distinct notice of these data sources once, in first-seen order. */
export function distinctNotices(
	dataSourceIds: Iterable<string>,
	notices: ReadonlyMap<string, string>
): string[] {
	const out = new Set<string>();
	for (const id of dataSourceIds) {
		const n = notices.get(id);
		if (n) out.add(n);
	}
	return [...out];
}
