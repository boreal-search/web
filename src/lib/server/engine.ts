// Server-only client for the boreal engine API. The bearer token never leaves the server:
// this module lives under lib/server so SvelteKit refuses to bundle it for the browser.
import { ENGINE_SERVICE_TOKEN, ENGINE_URL } from '$app/env/private';
import type {
	Answer,
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

/**
 * Per-call engine timeouts (ms). Drafting an answer runs an LLM on the workstation, so it gets
 * the longest; a plain search is embeddings + vector search + rerank.
 */
export const ENGINE_TIMEOUT_MS = { read: 8_000, search: 12_000, answer: 25_000 } as const;

async function request<T>(
	path: string,
	init: RequestInit = {},
	fetchFn: typeof fetch = fetch,
	timeoutMs: number = ENGINE_TIMEOUT_MS.read
) {
	const res = await fetchFn(new URL(path, ENGINE_URL), {
		...init,
		signal: AbortSignal.timeout(timeoutMs),
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

/** Why an engine call failed, in terms the user can act on. */
export type EngineFailure =
	/** No response within ENGINE_TIMEOUT_MS. */
	| { kind: 'timeout' }
	/** Network error, or the tunnel's 502/504/530: the workstation is off or restarting. */
	| { kind: 'unreachable' }
	/** 503: the engine is up but Qdrant or Ollama is down. */
	| { kind: 'unavailable'; detail: string }
	/** Any other engine error (status null when it wasn't an HTTP error). */
	| { kind: 'error'; status: number | null; detail: string };

/** Statuses the Cloudflare tunnel returns when the engine behind it is down. */
const TUNNEL_DOWN = new Set([502, 504, 530]);

export function classifyEngineError(e: unknown): EngineFailure {
	if (e instanceof EngineError) {
		if (TUNNEL_DOWN.has(e.status)) return { kind: 'unreachable' };
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

/** What happened and what to do, for banners and the search page. */
export function engineFailureMessage(f: EngineFailure): string {
	switch (f.kind) {
		case 'timeout':
			return 'The search engine took too long to respond. Try again in a moment.';
		case 'unreachable':
			return 'The search engine is offline (its server is down or restarting). Try again in a few minutes; if it stays down, contact us.';
		case 'unavailable':
			return `Search is temporarily unavailable (${f.detail}). Try again in a few minutes.`;
		case 'error':
			return `The search engine returned an error (${f.status ?? 'no response'}: ${f.detail}). Try again; if it keeps happening, contact us.`;
	}
}

/** HTTP status a route should answer with for each failure kind. */
export const FAILURE_HTTP_STATUS: Record<EngineFailure['kind'], number> = {
	timeout: 504,
	unreachable: 502,
	unavailable: 503,
	error: 502
};

export const engineErrorMessage = (e: unknown) => engineFailureMessage(classifyEngineError(e));

/** The drafted answer, when one was requested. */
export type AnswerOutcome =
	| { kind: 'off' }
	| { kind: 'ok'; answer: Answer }
	/** The engine answered that the results don't cover the question. */
	| { kind: 'abstained'; answer: Answer }
	/** 400: the engine has no LLM configured. */
	| { kind: 'disabled'; detail: string }
	/** The answer request failed; the results were fetched again without it. */
	| { kind: 'failed'; failure: EngineFailure };

interface SearchResults {
	response: SearchResponse;
	answer: AnswerOutcome;
}

/** `no_results` is a 200 with nothing matched: not an error, the user should broaden. */
export type SearchOutcome =
	({ kind: 'ok' } & SearchResults) | ({ kind: 'no_results' } & SearchResults) | EngineFailure;

/** Notice for an answer that was asked for but isn't shown; null otherwise. */
export function answerNotice(a: AnswerOutcome): string | null {
	if (a.kind === 'disabled')
		return 'Answer drafting is turned off on this engine; showing results only.';
	if (a.kind !== 'failed') return null;
	if (a.failure.kind === 'timeout') {
		return 'Drafting the answer took too long; showing results only. Try again, or untick "Draft an answer".';
	}
	return `The answer could not be drafted (${engineFailureMessage(a.failure)}); showing results only.`;
}

const answerOf = (r: SearchResponse): AnswerOutcome =>
	r.answer ? { kind: r.answer.abstained ? 'abstained' : 'ok', answer: r.answer } : { kind: 'off' };

/**
 * POST /search; never throws. The answer is optional, the search isn't: if the answer request
 * fails for any reason other than the engine being unreachable, retry without `answer` so the
 * user still gets results, and report what happened to the answer.
 */
export async function search(
	body: SearchRequest,
	fetchFn: typeof fetch = fetch
): Promise<SearchOutcome> {
	const post = (b: SearchRequest, timeoutMs: number) =>
		request<SearchResponse>(
			'/search',
			{ method: 'POST', body: JSON.stringify(b) },
			fetchFn,
			timeoutMs
		);
	const done = (response: SearchResponse, answer: AnswerOutcome): SearchOutcome =>
		response.results.length > 0
			? { kind: 'ok', response, answer }
			: { kind: 'no_results', response, answer };
	const resultsOnly = async (answer: AnswerOutcome) => {
		try {
			return done(await post({ ...body, answer: false }, ENGINE_TIMEOUT_MS.search), answer);
		} catch (e) {
			return classifyEngineError(e);
		}
	};

	if (!body.answer) return resultsOnly({ kind: 'off' });
	try {
		const response = await post(body, ENGINE_TIMEOUT_MS.answer);
		return done(response, answerOf(response));
	} catch (e) {
		const failure = classifyEngineError(e);
		if (failure.kind === 'unreachable') return failure;
		return resultsOnly(
			failure.kind === 'error' && failure.status === 400
				? { kind: 'disabled', detail: failure.detail }
				: { kind: 'failed', failure }
		);
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
