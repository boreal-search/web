// Permanent link to a page render: check access now, then 302 to a freshly signed engine URL.
import { error } from '@sveltejs/kit';
import {
	isValidKey,
	notFound,
	pageKey,
	requireFileAccess,
	signedRedirect,
	signFileUrl
} from '#lib/server/files.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const key = pageKey(params.ds, params.doc, params.page);
	if (!isValidKey(key)) notFound();
	await requireFileAccess(params.ds);
	const url = signFileUrl(key);
	// No engine call returns a page render's URL, so there is nothing to fall back to.
	if (!url) error(503, "Page links aren't set up on this server yet (FILE_SIGNING_KEY is unset).");
	return signedRedirect(url);
};
