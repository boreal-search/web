import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	ENGINE_URL: 'http://engine.test',
	ENGINE_SERVICE_TOKEN: 'test-token'
}));

const { EngineError, engineErrorMessage, search } = await import('./engine');

const ok = { query: 'q', results: [], retrieval_ms: 5, reranked: true };
const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sentBodies = (f: ReturnType<typeof vi.fn>) =>
	f.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

describe('search', () => {
	const body = { query: 'q', data_source_ids: ['s'], answer: true };

	it('retries without answer when the engine has no LLM (400)', async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(json(400, { detail: 'no LLM configured' }))
			.mockResolvedValueOnce(json(200, ok));
		const out = await search(body, f as typeof fetch);
		expect(out).toEqual({ response: ok, answerError: 'no LLM configured' });
		expect(sentBodies(f).map((b) => b.answer)).toEqual([true, false]);
	});

	it('returns the answer when the engine provides one', async () => {
		const withAnswer = { ...ok, answer: { text: 't', abstained: false } };
		const f = vi.fn().mockResolvedValueOnce(json(200, withAnswer));
		expect(await search(body, f as typeof fetch)).toEqual({
			response: withAnswer,
			answerError: null
		});
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('does not retry a 400 when no answer was requested', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(400, { detail: 'bad' }));
		await expect(search({ ...body, answer: false }, f as typeof fetch)).rejects.toMatchObject({
			status: 400
		});
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('surfaces 503 {detail} as an EngineError without retrying', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(503, { detail: 'Qdrant unreachable' }));
		const err = await search(body, f as typeof fetch).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(EngineError);
		expect(engineErrorMessage(err)).toBe('Search is temporarily unavailable: Qdrant unreachable');
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('sends the bearer token', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(200, ok));
		await search(body, f as typeof fetch);
		const init = f.mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
	});
});
