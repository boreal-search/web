// POST /search/stream: one trail step. Body: a StepRequest (JSON). Checks the user's access,
// then relays the engine's /search/stream to the browser as NDJSON StreamEvents, as they
// arrive, and records the step in the user's trail when the context keeps search history.
// Errors before the stream are JSON: { error } (400/401/403/404/409) or { failure } (engine).
import { json } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { CONTEXT_COOKIE, findForbiddenDataSources, getAccess } from '#lib/server/access.js';
import { FAILURE_STATUS, recordSearchEvent, type SearchEventInput } from '#lib/server/analytics.js';
import {
	classifyEngineError,
	engine,
	FAILURE_HTTP_STATUS,
	searchStream,
	STREAM_DEADLINE_MS
} from '#lib/server/engine.js';
import type { DataSource } from '#lib/server/engine.types.js';
import {
	driveStep,
	parseStepRequest,
	requestedDataSources,
	streamOutcome,
	type StepStore
} from '#lib/server/search-stream.js';
import { completeStep, insertStep } from '#lib/server/trails.js';
import { ndjson } from '#lib/ndjson.js';
import { newStep, type EngineEvent, type StreamEvent } from '#lib/trail.js';
import type { RequestHandler } from './$types';

// A summary can take up to STREAM_DEADLINE_MS.answer (180 s) while the workstation ingests.
export const config: Config = { maxDuration: 300 };

export const POST: RequestHandler = async ({ request, locals, cookies, fetch }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Sign in again to search.' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Send the search as JSON.' }, { status: 400 });
	}
	const parsed = parseStepRequest(body);
	if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
	const req = parsed.value;

	// Re-check access on every search, including the context's scopes: never trust the ids sent.
	const { context, dataSourceIds } = await getAccess(
		locals.supabase,
		user.id,
		cookies.get(CONTEXT_COOKIE)
	);
	const orgId = context.kind === 'org' ? context.org.id : null;
	// Attributed to the current org (null in Public). See analytics.ts.
	const record = (outcome: Pick<SearchEventInput, 'status' | 'response' | 'error'>) =>
		recordSearchEvent(locals.supabase, {
			orgId,
			userId: user.id,
			query: req.query,
			dataSourceIds: req.data_source_ids,
			topK: req.top_k,
			rerank: req.rerank,
			...outcome
		});

	const forbidden = findForbiddenDataSources(requestedDataSources(req), dataSourceIds);
	if (forbidden.length > 0) {
		await record({ status: 'forbidden', error: `forbidden: ${forbidden.join(',')}` });
		return json(
			{
				error: `You don't have access to: ${forbidden.join(', ')}. Reload the page to see what you can search.`
			},
			{ status: 403 }
		);
	}

	// Adding to a stored trail: it must be the user's own, from the context they're in now.
	if (req.trail_id !== null) {
		const { data: trail, error } = await locals.supabase
			.from('trails')
			.select('user_id, org_id')
			.eq('id', req.trail_id)
			.maybeSingle();
		if (error) throw error;
		if (!trail || trail.user_id !== user.id)
			return json({ error: 'That trail was not found.' }, { status: 404 });
		if (trail.org_id !== orgId) {
			return json(
				{
					error:
						'This trail belongs to another context. Switch back to it to refine, or start a new search.'
				},
				{ status: 409 }
			);
		}
	}

	// Public trails are always kept; an org's only when it keeps search history.
	const historyQuery =
		orgId === null
			? Promise.resolve(true)
			: locals.supabase
					.from('orgs')
					.select('conversation_history')
					.eq('id', orgId)
					.single()
					.then(({ data, error }) => {
						if (error) console.error('conversation_history lookup failed', error);
						return data?.conversation_history ?? false;
					});
	// Names and index dates for the step's scope chip and readout; ids stand in if this fails.
	const listing = engine(fetch)
		.listDataSources()
		.catch((e: unknown): DataSource[] => {
			console.error('data source listing failed', e);
			return [];
		});

	const deadline = AbortSignal.timeout(
		req.answer ? STREAM_DEADLINE_MS.answer : STREAM_DEADLINE_MS.search
	);
	const stop = new AbortController(); // the browser cancelled the response body
	const signal = AbortSignal.any([deadline, request.signal, stop.signal]);

	let res: Response;
	try {
		res = await searchStream(
			{
				query: req.query,
				data_source_ids: req.data_source_ids,
				document_ids: req.document_ids,
				context: req.context,
				rewrite: req.rewrite,
				doc_filter: req.doc_filter,
				answer: req.answer,
				top_k: req.top_k,
				rerank: req.rerank
			},
			fetch,
			signal
		);
		if (!res.body) throw new Error('The search engine sent no stream.');
	} catch (e) {
		const failure = classifyEngineError(e);
		const detail = 'detail' in failure ? failure.detail : undefined;
		await record({
			status: FAILURE_STATUS[failure.kind],
			error: detail ? `${failure.kind}: ${detail}` : failure.kind
		});
		return json({ failure }, { status: FAILURE_HTTP_STATUS[failure.kind] });
	}
	const events = ndjson<EngineEvent>(res.body);

	const [history, list] = await Promise.all([historyQuery, listing]);
	const names = Object.fromEntries(list.map((ds) => [ds.id, ds.name]));
	const indexedAt = Object.fromEntries(list.map((ds) => [ds.id, ds.indexed_at]));
	// n is a placeholder: the database numbers stored steps, the browser numbers unstored ones.
	const step = newStep(req, 0, names, indexedAt);

	const store: StepStore | null = history
		? {
				insert: (s) => insertStep(locals.supabase, req.trail_id, orgId, s),
				complete: (at, s) => completeStep(locals.supabase, at, s)
			}
		: null;

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let open = true;
			const send = (event: StreamEvent) => {
				if (!open) return;
				try {
					controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
				} catch {
					open = false; // the browser went away; keep recording
				}
			};
			// Resolves only after the step's last write: the function stays alive until then.
			const result = await driveStep({
				events,
				step,
				from: req.from,
				send,
				store,
				timedOut: () => deadline.aborted
			});
			await record(streamOutcome(result.step, result.results));
			try {
				controller.close();
			} catch {
				// already cancelled
			}
		},
		cancel() {
			stop.abort();
		}
	});

	return new Response(stream, {
		headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }
	});
};
