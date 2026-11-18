import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { waitUntil } = vi.hoisted(() => ({ waitUntil: vi.fn<(p: Promise<unknown>) => void>() }));
vi.mock('@vercel/functions', () => ({ waitUntil }));
import type { Database } from '#lib/supabase/types.js';
import { buildSearchEvent, recordSearchEvent } from './analytics';
import type { SearchResponse } from './engine.types';
import { answer, step } from '#lib/trail.fixture.js';

const response: SearchResponse = {
	query: 'noise limits',
	resolved_query: 'noise limits',
	scope: { data_source_ids: ['bc-regs'], document_ids: null, inferred_documents: [] },
	readout: {
		pages_searched: 100,
		documents_searched: 1,
		pages_returned: 1,
		retrieval_ms: 42,
		total_ms: 42
	},
	results: [
		{
			document_id: 'd1',
			document_title: 'Reg 12/2018',
			data_source_id: 'bc-regs',
			page_number: 4,
			section: null,
			score: 0.83,
			page_image_url: 'https://r2/p.webp',
			pdf_url: 'https://r2/d.pdf#page=4',
			snippet: null
		}
	],
	retrieval_ms: 42,
	reranked: true
};

describe('buildSearchEvent', () => {
	const input = {
		orgId: 'org-a',
		userId: 'u1',
		query: 'noise limits',
		dataSourceIds: ['bc-regs'],
		topK: 10,
		rerank: true,
		logQueries: true,
		status: 'ok' as const,
		response
	};

	it('captures result stats from the engine response', () => {
		expect(buildSearchEvent(input)).toMatchObject({
			query: 'noise limits',
			query_length: 12,
			result_count: 1,
			top_score: 0.83,
			retrieval_ms: 42,
			reranked: true,
			error: null
		});
	});

	it('drops query text but keeps its length when the org opts out', () => {
		expect(buildSearchEvent({ ...input, logQueries: false })).toMatchObject({
			query: null,
			query_length: 12
		});
	});

	it('records errors with null result stats', () => {
		const row = buildSearchEvent({
			...input,
			status: 'engine_error',
			response: undefined,
			error: '502 upstream'
		});
		expect(row).toMatchObject({
			status: 'engine_error',
			result_count: null,
			top_score: null,
			retrieval_ms: null,
			error: '502 upstream'
		});
	});

	const seen = {
		step: step(2, { resolved: 'noise limits at night', answer: answer() }),
		at: { trail_id: 'trail-1', n: 2 }
	};

	it('keeps what the user saw and where it sits in their trail', () => {
		const row = buildSearchEvent({ ...input, id: 'e1', seen });
		expect(row).toMatchObject({
			id: 'e1',
			trail_id: 'trail-1',
			step_n: 2,
			resolved_query: 'noise limits at night',
			answer: { abstained: false },
			total_ms: 3400
		});
		expect(row.results).toHaveLength(seen.step.results.length);
		expect(JSON.stringify(row.results)).not.toMatch(/page_image_url/);
	});

	it('drops the summary and results with the query text when the org opts out', () => {
		const row = buildSearchEvent({ ...input, seen, logQueries: false });
		expect(row).toMatchObject({
			resolved_query: null,
			answer: null,
			results: null,
			trail_id: null,
			step_n: null,
			total_ms: 3400
		});
		expect(row).not.toHaveProperty('id');
	});
});

describe('recordSearchEvent', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		waitUntil.mockReset();
	});

	const input = {
		orgId: 'org-a',
		userId: 'u1',
		query: 'noise limits',
		dataSourceIds: ['bc-regs'],
		topK: 10,
		rerank: true,
		logQueries: true,
		status: 'ok' as const
	};

	/** The insert waits until `release()`. */
	function fakeSupabase() {
		const gate = Promise.withResolvers<void>();
		const insert = vi.fn(() => gate.promise.then(() => ({ error: null })));
		const client = { from: () => ({ insert }) };
		return {
			insert,
			release: () => gate.resolve(),
			supabase: client as unknown as SupabaseClient<Database>
		};
	}

	it('awaits the insert off-Vercel (dev/tests)', async () => {
		const { insert, release, supabase } = fakeSupabase();
		let settled = false;
		const done = recordSearchEvent(supabase, input).then(() => (settled = true));
		await Promise.resolve();
		expect(settled).toBe(false);
		release();
		await done;
		expect(waitUntil).not.toHaveBeenCalled();
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-a', status: 'ok' }));
	});

	it('hands the insert to waitUntil on Vercel instead of blocking the response', async () => {
		vi.stubEnv('VERCEL', '1');
		const { insert, release, supabase } = fakeSupabase();

		// Resolves while the insert is still pending: the response is not held up.
		await recordSearchEvent(supabase, input);
		expect(waitUntil).toHaveBeenCalledTimes(1);
		expect(insert).toHaveBeenCalledTimes(1);

		release();
		expect(await waitUntil.mock.calls[0][0]).toBe(true);
	});
});
