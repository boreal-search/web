import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { waitUntil } = vi.hoisted(() => ({ waitUntil: vi.fn<(p: Promise<unknown>) => void>() }));
vi.mock('@vercel/functions', () => ({ waitUntil }));
import type { Database } from '#lib/supabase/types.js';
import { resolveSearchOrg } from './access';
import { buildSearchEvent, recordSearchEvent } from './analytics';
import type { SearchResponse } from './engine.types';

const response: SearchResponse = {
	query: 'noise limits',
	results: [
		{
			document_id: 'd1',
			document_title: 'Reg 12/2018',
			data_source_id: 'bc-regs',
			page_number: 4,
			score: 0.83,
			page_image_url: 'https://r2/p.webp',
			pdf_url: 'https://r2/d.pdf#page=4',
			snippet: null
		}
	],
	retrieval_ms: 42,
	reranked: true
};

describe('resolveSearchOrg', () => {
	const grants = [
		{ org_id: 'org-a', data_source_id: 'bc-regs' },
		{ org_id: 'org-b', data_source_id: 'bc-regs' },
		{ org_id: 'org-b', data_source_id: 'fed-regs' }
	];

	it('prefers an org that grants every requested data source', () => {
		expect(resolveSearchOrg(['bc-regs', 'fed-regs'], grants)).toBe('org-b');
	});

	it('falls back to the first org granting any of them', () => {
		expect(resolveSearchOrg(['bc-regs', 'nope'], grants)).toBe('org-a');
	});

	it('returns null with no grants or no request', () => {
		expect(resolveSearchOrg(['bc-regs'], [])).toBeNull();
		expect(resolveSearchOrg([], grants)).toBeNull();
	});
});

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
		const release = () => org.resolve({ data: { log_queries: true }, error: null });
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
