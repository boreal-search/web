import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	ENGINE_URL: 'http://engine.test',
	ENGINE_SERVICE_TOKEN: 'test-token'
}));

const { EngineError, classifyEngineError, searchStream } = await import('./engine');

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const timeout = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

describe('classifyEngineError', () => {
	it.each([
		[new EngineError(502, 'Bad Gateway'), { kind: 'unreachable' }],
		[new EngineError(504, 'Gateway Timeout'), { kind: 'unreachable' }],
		[new EngineError(530, 'Origin unreachable'), { kind: 'unreachable' }],
		[new TypeError('fetch failed'), { kind: 'unreachable' }],
		[timeout(), { kind: 'timeout' }],
		[
			new EngineError(503, 'Qdrant unreachable'),
			{ kind: 'unavailable', detail: 'Qdrant unreachable' }
		],
		[
			new EngineError(404, 'unknown data sources: x'),
			{ kind: 'error', status: 404, detail: 'unknown data sources: x' }
		],
		[
			new SyntaxError('Unexpected token <'),
			{ kind: 'error', status: null, detail: 'Unexpected token <' }
		]
	])('%o → %o', (e, kind) => {
		expect(classifyEngineError(e)).toEqual(kind);
	});
});

describe('searchStream', () => {
	const body = { query: 'q', data_source_ids: ['s'], answer: true };

	it("posts the request with the bearer token and the caller's signal, and returns the stream", async () => {
		const stream = new Response('{"type":"done"}\n', { status: 200 });
		const f = vi.fn().mockResolvedValueOnce(stream);
		const signal = new AbortController().signal;
		expect(await searchStream(body, f as typeof fetch, signal)).toBe(stream);
		const [url, init] = f.mock.calls[0] as [URL, RequestInit];
		expect(String(url)).toBe('http://engine.test/search/stream');
		expect(JSON.parse(init.body as string)).toEqual(body);
		expect(init.signal).toBe(signal);
		expect(init.headers).toMatchObject({
			authorization: 'Bearer test-token',
			accept: 'application/x-ndjson',
			'content-type': 'application/json'
		});
	});

	it("throws the engine's detail for a request error before streaming", async () => {
		const f = vi.fn().mockResolvedValueOnce(json(404, { detail: 'unknown documents: x' }));
		const e = await searchStream(body, f as typeof fetch, new AbortController().signal).catch(
			(err: unknown) => err
		);
		expect(classifyEngineError(e)).toEqual({
			kind: 'error',
			status: 404,
			detail: 'unknown documents: x'
		});
	});
});
