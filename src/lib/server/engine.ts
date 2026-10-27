// Server-only client for the boreal engine API. The bearer token never leaves the server:
// this module lives under lib/server so SvelteKit refuses to bundle it for the browser.
import { ENGINE_SERVICE_TOKEN, ENGINE_URL } from '$app/env/private';
import type {
	DataSource,
	Document,
	DocumentPage,
	EngineErrorBody,
	Health,
	Job,
	JobStatus,
	SearchRequest,
	SearchResponse
} from './engine.types';

export type { Answer, Claim, SearchResponse, SearchResult, Verification } from './engine.types';

export class EngineError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'EngineError';
	}
}

async function request<T>(path: string, init: RequestInit = {}, fetchFn: typeof fetch = fetch) {
	const res = await fetchFn(new URL(path, ENGINE_URL), {
		...init,
		headers: {
			accept: 'application/json',
			authorization: `Bearer ${ENGINE_SERVICE_TOKEN}`,
			...(init.body ? { 'content-type': 'application/json' } : {}),
			...init.headers
		}
	});

	if (!res.ok) {
		let detail = res.statusText;
		try {
			detail = ((await res.json()) as EngineErrorBody).detail ?? detail;
		} catch {
			// non-JSON error body; keep statusText
		}
		throw new EngineError(res.status, detail);
	}
	return (await res.json()) as T;
}

/** User-facing message for a failed engine call. 503 = Qdrant/Ollama down on the engine side. */
export function engineErrorMessage(e: unknown): string {
	if (!(e instanceof EngineError)) return 'Engine unreachable';
	if (e.status === 503) return `Search is temporarily unavailable: ${e.message}`;
	return `${e.status} ${e.message}`;
}

export interface SearchOutcome {
	response: SearchResponse;
	/** Set when an answer was requested but the engine refused it (400: no LLM configured). */
	answerError: string | null;
}

/**
 * POST /search. With `answer: true`, a 400 means the engine has no LLM configured: retry
 * without `answer` so the user still gets results (the answer is optional, the search isn't).
 */
export async function search(
	body: SearchRequest,
	fetchFn: typeof fetch = fetch
): Promise<SearchOutcome> {
	const post = (b: SearchRequest) =>
		request<SearchResponse>('/search', { method: 'POST', body: JSON.stringify(b) }, fetchFn);
	try {
		return { response: await post(body), answerError: null };
	} catch (e) {
		if (!body.answer || !(e instanceof EngineError) || e.status !== 400) throw e;
		return { response: await post({ ...body, answer: false }), answerError: e.message };
	}
}

function query(params: Record<string, string | number | undefined>) {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
	const s = qs.toString();
	return s ? `?${s}` : '';
}

/**
 * Pass `event.fetch` from a load/action so SvelteKit can trace the request.
 * Authorization (which org may query which data source) is the caller's job.
 */
export function engine(fetchFn: typeof fetch = fetch) {
	return {
		health: () => request<Health>('/health', {}, fetchFn),

		listDataSources: () => request<DataSource[]>('/data-sources', {}, fetchFn),

		getDataSource: (id: string) =>
			request<DataSource>(`/data-sources/${encodeURIComponent(id)}`, {}, fetchFn),

		listDocuments: (dataSourceId: string, opts: { limit?: number; offset?: number } = {}) =>
			request<DocumentPage>(
				`/data-sources/${encodeURIComponent(dataSourceId)}/documents${query(opts)}`,
				{},
				fetchFn
			),

		getDocument: (id: string) =>
			request<Document>(`/documents/${encodeURIComponent(id)}`, {}, fetchFn),

		search: (body: SearchRequest) => search(body, fetchFn),

		listJobs: (opts: { data_source_id?: string; status?: JobStatus; limit?: number } = {}) =>
			request<Job[]>(`/jobs${query(opts)}`, {}, fetchFn)
	};
}
