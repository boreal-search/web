// Server-only client for the boreal engine API. The bearer token never leaves the server:
// this module lives under lib/server so SvelteKit refuses to bundle it for the browser.
import { ENGINE_SERVICE_TOKEN, ENGINE_URL } from '$app/env/private';
import type { EngineFailure, Loaded } from '#lib/failure.js';
import type {
	DataSource,
	Document,
	DocumentPage,
	EngineErrorBody,
	Job,
	JobStatus,
	SearchRequest
} from './engine.types';

export class EngineError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'EngineError';
	}
}

/** Engine call timeout (ms) for reads: data sources, documents, jobs. */
export const ENGINE_TIMEOUT_MS = { read: 8_000 } as const;

/**
 * Deadline (ms) for a whole /search/stream, results and summary. Drafting and checking a
 * summary run an LLM on the engine host; while it is ingesting it can take minutes.
 */
export const STREAM_DEADLINE_MS = { answer: 180_000, search: 60_000 } as const;

/** Fetch an engine path with the service token; throws EngineError on a non-2xx. */
async function call(path: string, init: RequestInit, fetchFn: typeof fetch, signal: AbortSignal) {
	const res = await fetchFn(new URL(path, ENGINE_URL), {
		...init,
		signal,
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
	return res;
}

async function request<T>(path: string, fetchFn: typeof fetch = fetch) {
	const res = await call(path, {}, fetchFn, AbortSignal.timeout(ENGINE_TIMEOUT_MS.read));
	return (await res.json()) as T;
}

/**
 * POST /search/stream. Resolves once the engine starts streaming (its 200): the body is NDJSON
 * `EngineEvent`s. Request errors (400/404/422, 503) throw EngineError with the engine's detail.
 * `signal` is the caller's: the overall deadline and the browser going away.
 */
export const searchStream = (body: SearchRequest, fetchFn: typeof fetch, signal: AbortSignal) =>
	call(
		'/search/stream',
		{ method: 'POST', body: JSON.stringify(body), headers: { accept: 'application/x-ndjson' } },
		fetchFn,
		signal
	);

/** Proxy statuses returned when the engine behind it is down. */
const PROXY_DOWN = new Set([502, 504, 530]);

export function classifyEngineError(e: unknown): EngineFailure {
	if (e instanceof EngineError) {
		if (PROXY_DOWN.has(e.status)) return { kind: 'unreachable' };
		if (e.status === 503) return { kind: 'unavailable', detail: e.message };
		return { kind: 'error', status: e.status, detail: e.message };
	}
	// AbortSignal.timeout() rejects with a DOMException named TimeoutError.
	if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
		return { kind: 'timeout' };
	}
	// fetch() rejects with a TypeError on DNS/connection failures.
	if (e instanceof TypeError) return { kind: 'unreachable' };
	return { kind: 'error', status: null, detail: e instanceof Error ? e.message : String(e) };
}

/**
 * An engine read for a load to return un-awaited (SvelteKit streams it): a rejection becomes a
 * failure the page renders, never an unhandled rejection.
 */
export const settle = <T>(read: Promise<T>): Promise<Loaded<T>> =>
	read.then(
		(data) => ({ ok: true, data }),
		(e: unknown) => ({ ok: false, failure: classifyEngineError(e) })
	);

/** HTTP status a route should answer with for each failure kind. */
export const FAILURE_HTTP_STATUS: Record<EngineFailure['kind'], number> = {
	timeout: 504,
	unreachable: 502,
	unavailable: 503,
	error: 502
};

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
		listDataSources: () => request<DataSource[]>('/data-sources', fetchFn),

		getDataSource: (id: string) =>
			request<DataSource>(`/data-sources/${encodeURIComponent(id)}`, fetchFn),

		listDocuments: (dataSourceId: string, opts: { limit?: number; offset?: number } = {}) =>
			request<DocumentPage>(
				`/data-sources/${encodeURIComponent(dataSourceId)}/documents${query(opts)}`,
				fetchFn
			),

		getDocument: (id: string) => request<Document>(`/documents/${encodeURIComponent(id)}`, fetchFn),

		listJobs: (opts: { data_source_id?: string; status?: JobStatus; limit?: number } = {}) =>
			request<Job[]>(`/jobs${query(opts)}`, fetchFn)
	};
}
