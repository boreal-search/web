// Permanent link to a PDF, optionally at a page (`?page=n` → `#page=n`): check access now, then
// 302 to a freshly signed engine URL.
import { error } from '@sveltejs/kit';
import { describeFailure } from '#lib/failure.js';
import {
	classifyEngineError,
	engine,
	EngineError,
	FAILURE_HTTP_STATUS
} from '#lib/server/engine.js';
import {
	documentKey,
	isValidKey,
	notFound,
	requireFileAccess,
	signedRedirect,
	signFileUrl
} from '#lib/server/files.js';
import type { RequestHandler } from './$types';

const PAGE_RE = /^[1-9][0-9]{0,5}$/;

/** Without FILE_SIGNING_KEY: the engine's own signed URL for the document. */
async function engineSignedUrl(fetchFn: typeof fetch, ds: string, doc: string) {
	let d;
	try {
		d = await engine(fetchFn).getDocument(doc);
	} catch (e) {
		if (e instanceof EngineError && e.status === 404) notFound();
		const failure = classifyEngineError(e);
		error(FAILURE_HTTP_STATUS[failure.kind], describeFailure(failure).title, { failure });
	}
	if (d.data_source_id !== ds) notFound();
	return d.pdf_url.split('#')[0];
}

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const key = documentKey(params.ds, params.doc);
	if (!isValidKey(key)) notFound();
	await requireFileAccess(params.ds);
	const page = url.searchParams.get('page') ?? '';
	const signed = signFileUrl(key) ?? (await engineSignedUrl(fetch, params.ds, params.doc));
	return signedRedirect(PAGE_RE.test(page) ? `${signed}#page=${page}` : signed);
};
