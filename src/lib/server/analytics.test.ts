import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { waitUntil } = vi.hoisted(() => ({ waitUntil: vi.fn<(p: Promise<unknown>) => void>() }));
vi.mock('@vercel/functions', () => ({ waitUntil }));
import type { Database } from '#lib/supabase/types.js';
import { buildSearchEvent, recordSearchEvent } from './analytics';
import type { SearchResponse } from './engine.types';

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
		status: 'ok' as const,
		response
	};

	it('captures result stats from the engine response', () => {
		expect(buildSearchEvent(input, true)).toMatchObject({
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
		expect(buildSearchEvent(input, false)).toMatchObject({ query: null, query_length: 12 });
	});

	it('records errors with null result stats', () => {
		const row = buildSearchEvent(
			{ ...input, status: 'engine_error', response: undefined, error: '502 upstream' },
			true
		);
		expect(row).toMatchObject({
			status: 'engine_error',
			result_count: null,
			top_score: null,
			retrieval_ms: null,
			error: '502 upstream'
		});
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
		status: 'ok' as const
	};

	/** Minimal stand-in for the two queries; the org lookup waits until `release()`. */
	function fakeSupabase() {
		const insert = vi.fn().mockResolvedValue({ error: null });
		const org = Promise.withResolvers<{ data: { log_queries: boolean }; error: null }>();
		const client = {
			from: (table: string) =>
				table === 'orgs'
					? { select: () => ({ eq: () => ({ single: () => org.promise }) }) }
					: { insert }
		};
		const release = (logQueries = true) =>
			org.resolve({ data: { log_queries: logQueries }, error: null });
		return { insert, release, supabase: client as unknown as SupabaseClient<Database> };
	}

	it('awaits the insert off-Vercel (dev/tests)', async () => {
		const { insert, release, supabase } = fakeSupabase();
		const done = recordSearchEvent(supabase, input);
		release();
		await done;
		expect(waitUntil).not.toHaveBeenCalled();
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-a', status: 'ok' }));
	});

	it("applies the org's log_queries switch", async () => {
		const { insert, release, supabase } = fakeSupabase();
		const done = recordSearchEvent(supabase, input);
		release(false);
		await done;
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-a', query: null }));
	});

	it('records a public search with a null org and the query text, without an org lookup', async () => {
		const { insert, supabase } = fakeSupabase(); // never released: a lookup would hang
		await recordSearchEvent(supabase, { ...input, orgId: null });
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({ org_id: null, query: 'noise limits', query_length: 12 })
		);
	});

	it('hands the insert to waitUntil on Vercel instead of blocking the response', async () => {
		vi.stubEnv('VERCEL', '1');
		const { insert, release, supabase } = fakeSupabase();

		// Resolves while the org lookup is still pending: the response is not held up.
		await recordSearchEvent(supabase, input);
		expect(waitUntil).toHaveBeenCalledTimes(1);
		expect(insert).not.toHaveBeenCalled();

		release();
		await waitUntil.mock.calls[0][0];
		expect(insert).toHaveBeenCalledTimes(1);
	});
});
