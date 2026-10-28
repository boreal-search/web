import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	ENGINE_URL: 'http://engine.test',
	ENGINE_SERVICE_TOKEN: 'test-token'
}));

const { EngineError, answerNotice, classifyEngineError, search } = await import('./engine');

const hit = {
	document_id: 'd1',
	document_title: 'Reg',
	data_source_id: 's',
	page_number: 1,
	score: 0.9,
	page_image_url: 'https://r2/p.webp',
	pdf_url: 'https://r2/d.pdf#page=1',
	snippet: null
};
const ok = { query: 'q', results: [hit], retrieval_ms: 5, reranked: true };
const empty = { ...ok, results: [] };
const answer = {
	text: 't',
	abstained: false,
	sources: [],
	verification: null,
	model: 'm',
	generation_ms: 1,
	verify_ms: 1
};
const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sentBodies = (f: ReturnType<typeof vi.fn>) =>
	f.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
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

describe('search', () => {
	const body = { query: 'q', data_source_ids: ['s'], answer: true };

	it('returns results and the answer', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(200, { ...ok, answer }));
		expect(await search(body, f as typeof fetch)).toEqual({
			kind: 'ok',
			response: { ...ok, answer },
			answer: { kind: 'ok', answer }
		});
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('reports an abstained answer', async () => {
		const abstained = { ...answer, abstained: true };
		const f = vi.fn().mockResolvedValueOnce(json(200, { ...ok, answer: abstained }));
		const out = await search(body, f as typeof fetch);
		expect(out).toMatchObject({ kind: 'ok', answer: { kind: 'abstained' } });
	});

	it('200 with no results is no_results, not an error', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(200, empty));
		const out = await search({ ...body, answer: false }, f as typeof fetch);
		expect(out).toEqual({ kind: 'no_results', response: empty, answer: { kind: 'off' } });
	});

	it('retries without answer when the engine has no LLM (400)', async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(json(400, { detail: 'no LLM configured' }))
			.mockResolvedValueOnce(json(200, ok));
		const out = await search(body, f as typeof fetch);
		expect(out).toEqual({
			kind: 'ok',
			response: ok,
			answer: { kind: 'disabled', detail: 'no LLM configured' }
		});
		expect(sentBodies(f).map((b) => b.answer)).toEqual([true, false]);
	});

	it('keeps the results when only the answer times out', async () => {
		const f = vi.fn().mockRejectedValueOnce(timeout()).mockResolvedValueOnce(json(200, ok));
		const out = await search(body, f as typeof fetch);
		expect(out).toEqual({
			kind: 'ok',
			response: ok,
			answer: { kind: 'failed', failure: { kind: 'timeout' } }
		});
		if (out.kind === 'ok') expect(answerNotice(out.answer)).toMatch(/too long/);
	});

	it('says why the answer failed, with the reading', () => {
		expect(
			answerNotice({ kind: 'failed', failure: { kind: 'unavailable', detail: 'Ollama down' } })
		).toBe(
			'The answer could not be drafted (search is temporarily unavailable: 503: Ollama down); showing results only.'
		);
	});

	it('does not retry when the engine is unreachable', async () => {
		const f = vi.fn().mockResolvedValueOnce(new Response('down', { status: 530 }));
		expect(await search(body, f as typeof fetch)).toEqual({ kind: 'unreachable' });
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('reports 503 as unavailable when the retry fails too', async () => {
		const f = vi.fn(async () => json(503, { detail: 'Qdrant unreachable' }));
		expect(await search(body, f as typeof fetch)).toEqual({
			kind: 'unavailable',
			detail: 'Qdrant unreachable'
		});
		expect(f).toHaveBeenCalledTimes(2);
	});

	it('times out a plain search', async () => {
		const f = vi.fn().mockRejectedValueOnce(timeout());
		expect(await search({ ...body, answer: false }, f as typeof fetch)).toEqual({
			kind: 'timeout'
		});
	});

	it('sends the bearer token and a timeout signal', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(200, ok));
		await search(body, f as typeof fetch);
		const init = f.mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});
});
